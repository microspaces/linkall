# Export LinkAll8 SQL (groups, performances, comments). No users/passwords/photos.
# Connection is read from LINKALL8_SQL or the legacy appsettings DefaultConnection.
param(
  [string]$OutFile = (Join-Path $PSScriptRoot "linkall8-export.json")
)

$cs = $env:LINKALL8_SQL
if (-not $cs) {
  $appsettings = Join-Path $PSScriptRoot "..\..\..\..\LinkAll8\Link\appsettings.json"
  if (Test-Path $appsettings) {
    $json = Get-Content $appsettings -Raw | ConvertFrom-Json
    $cs = $json.ConnectionStrings.DefaultConnection
  }
}
if (-not $cs) { throw "Set LINKALL8_SQL or keep LinkAll8 appsettings.json available." }

function Query($sql) {
  $conn = New-Object System.Data.SqlClient.SqlConnection $cs
  $cmd = $conn.CreateCommand()
  $cmd.CommandText = $sql
  $cmd.CommandTimeout = 120
  $conn.Open()
  $reader = $cmd.ExecuteReader()
  $rows = @()
  while ($reader.Read()) {
    $row = [ordered]@{}
    for ($i = 0; $i -lt $reader.FieldCount; $i++) {
      $val = $reader.GetValue($i)
      if ($val -is [DBNull]) { $val = $null }
      $row[$reader.GetName($i)] = $val
    }
    $rows += [pscustomobject]$row
  }
  $reader.Close()
  $conn.Close()
  return $rows
}

function CleanName([string]$name) {
  if (-not $name) { return "" }
  return ($name -replace '^[\u03A9Ω\s]+', '').Trim()
}

function GroupKind($row) {
  if ($row.GeoTypeId -eq 1) { return "state" }
  if ($row.GeoTypeId -eq 2) { return "county" }
  if ($row.GroupTypeId -eq 2) { return "private" }
  return "public"
}

function ParseStateCounty([string]$name, [string]$kind) {
  $state = $null
  $county = $null
  if ($kind -eq "state") {
    $state = $name
  } elseif ($kind -eq "county" -and $name -match "^([^-]+)-(.+)$") {
    $state = $Matches[1].Trim()
    $county = $Matches[2].Trim()
  }
  return @{ state = $state; county = $county }
}

function CategoryFor([int]$siteId, [string]$name) {
  if ($siteId -ne 2) { return $null }
  $n = $name.ToLower()
  if ($n -match "crazyball|comedy loco") { return "comedyloco" }
  if ($n -match "headcase") { return "headcase" }
  if ($n -match "laff") { return "laffup" }
  if ($n -match "wwcce") { return "wwcce" }
  return $null
}

Write-Host "Exporting groups..."
$groupRows = Query @"
SELECT Id, Name, Description, GroupTypeId, GeoTypeId, Leftmenu, NumberOfMember, SiteId
FROM [Group]
"@

$groups = foreach ($g in $groupRows) {
  $name = CleanName ([string]$g.Name)
  if ($g.SiteId -eq 2 -and $name -eq "Crazyball") { $name = "Comedy Loco" }
  if (-not $name) { continue }
  $kind = GroupKind $g
  $geo = ParseStateCounty $name $kind
  $desc = [string]$g.Description
  if (-not $desc) { $desc = $name }
  [pscustomobject]@{
    legacyId = [string]$g.Id
    name = $name
    description = $desc
    kind = $kind
    state = $geo.state
    county = $geo.county
    leftmenu = if ($g.Leftmenu -eq 1 -or $g.Leftmenu -eq 2) { [int]$g.Leftmenu } else { $null }
    memberCount = [int]($g.NumberOfMember)
    category = CategoryFor ([int]$g.SiteId) $name
    siteId = [int]$g.SiteId
  }
}

Write-Host "Exporting performances..."
$perfRows = Query "SELECT LLPerformanceId, Name FROM LLPerformance WHERE IsDeleted = 0 OR IsDeleted IS NULL"
$gameRows = Query @"
SELECT g.LLPerformanceId, g.Round, g.LLTeamId, t.Name AS TeamName, gm.Name AS GameName, rt.Name AS RoundType
FROM LLPerformanceRoundTeamGame g
LEFT JOIN LLTeam t ON t.LLTeamId = g.LLTeamId
LEFT JOIN LLGame gm ON gm.LLGameId = g.LLGameId
LEFT JOIN LLRoundType rt ON rt.LLRoundTypeId = g.LLRoundTypeId
WHERE g.IsDeleted = 0 OR g.IsDeleted IS NULL
ORDER BY g.LLPerformanceId, g.Round, g.LLTeamId
"@
$perfJoin = Query @"
SELECT x.LLPerformanceId, p.Name AS PerformerName, t.Name AS TeamName, x.LLTeamId
FROM LLPerformanceTeamPerformer x
JOIN LLPerformer p ON p.LLPerformerId = x.LLPerformerId
LEFT JOIN LLTeam t ON t.LLTeamId = x.LLTeamId
WHERE x.IsDeleted = 0 OR x.IsDeleted IS NULL
"@

$gamesByPerf = $gameRows | Group-Object LLPerformanceId
$perfByPerf = $perfJoin | Group-Object LLPerformanceId

function TeamIndex([string]$team, $team1) {
  if ($team -and $team1 -and $team -eq $team1) { return 1 }
  return 2
}

function RenameLegacy([string]$text) {
  if (-not $text) { return $text }
  return ($text -replace 'Crazyball', 'Comedy Loco' -replace 'crazyball', 'comedyloco')
}

$performances = foreach ($p in $perfRows) {
  $perfId = [string]$p.LLPerformanceId
  $grows = @($gamesByPerf | Where-Object { [string]$_.Name -eq $perfId } | Select-Object -ExpandProperty Group -ErrorAction SilentlyContinue)
  if (-not $grows) { continue }
  $teams = @($grows | ForEach-Object { $_.TeamName } | Where-Object { $_ } | Select-Object -Unique)
  $team1 = if ($teams.Count -ge 1) { [string]$teams[0] } else { "Bananas" }
  $team2 = if ($teams.Count -ge 2) { [string]$teams[1] } else { "Clubtrotters" }
  if ($team2 -eq "Clubttotters") { $team2 = "Clubtrotters" }
  $order = 0
  $games = foreach ($g in $grows) {
    if (-not $g.GameName) { continue }
    $roundType = if ($g.RoundType) { [string]$g.RoundType } else { "Round" }
    $order++
    [pscustomobject]@{
      order = $order - 1
      round = [int]$g.Round
      roundType = $roundType
      teamIndex = TeamIndex ([string]$g.TeamName) $team1
      gameName = RenameLegacy ([string]$g.GameName)
      isScored = -not ($roundType -match "intro")
    }
  }
  $prows = @($perfByPerf | Where-Object { [string]$_.Name -eq $perfId } | Select-Object -ExpandProperty Group -ErrorAction SilentlyContinue)
  $performers = foreach ($r in $prows) {
    [pscustomobject]@{
      name = [string]$r.PerformerName
      teamIndex = TeamIndex ([string]$r.TeamName) $team1
    }
  }
  [pscustomobject]@{
    legacyId = [int]$perfId
    title = RenameLegacy ([string]$p.Name)
    team1 = $team1
    team2 = $team2
    games = @($games)
    performers = @($performers)
  }
}

Write-Host "Exporting comments..."
$commentRows = Query @"
SELECT Content, GroupId FROM Comment
WHERE Content IS NOT NULL AND LEN(Content) >= 8 AND Parent IS NULL
"@
$posts = foreach ($c in $commentRows) {
  $text = [string]$c.Content
  if ($text -match "^\?+$") { continue }
  [pscustomobject]@{
    legacyGroupId = if ($c.GroupId) { [string]$c.GroupId } else { $null }
    content = $text.Trim()
  }
}

$payload = [ordered]@{
  exportedAt = (Get-Date).ToUniversalTime().ToString("o")
  groups = @($groups)
  performances = @($performances)
  posts = @($posts)
}

$json = $payload | ConvertTo-Json -Depth 8
[System.IO.File]::WriteAllText($OutFile, $json)
Write-Host ("Wrote {0} groups, {1} performances, {2} posts -> {3}" -f $groups.Count, $performances.Count, $posts.Count, $OutFile)
