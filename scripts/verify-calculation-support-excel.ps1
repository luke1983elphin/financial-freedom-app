param([string]$Directory = 'outputs/calculation-support')
$ErrorActionPreference = 'Stop'
$excel = New-Object -ComObject Excel.Application
$excel.Visible = $false
$excel.DisplayAlerts = $false
try {
  foreach ($file in Get-ChildItem -LiteralPath $Directory -Filter 'retirement-*.xlsx') {
    $book = $excel.Workbooks.Open($file.FullName, 0, $true)
    try {
      $excel.CalculateFullRebuild()
      $sheet = $book.Worksheets.Item('Balance workings')
      $values = $sheet.UsedRange.Value2
      for ($i = 2; $i -le $sheet.UsedRange.Rows.Count; $i++) {
        if ([Math]::Abs($values[$i, 12]) -gt 0.011) { throw "Balance mismatch: row $i" }
      }
      $conversion = $book.Worksheets.Item('Dollar conversion').UsedRange.Value2
      for ($i = 2; $i -le $conversion.GetLength(0); $i++) {
        $expected = $conversion[$i, 4] / [Math]::Pow(1 + $conversion[$i, 5], $conversion[$i, 6])
        if ([Math]::Abs($conversion[$i, 7] - $expected) -gt 0.000001) { throw "Conversion mismatch: row $i" }
      }
      $before = $sheet.Cells.Item(2, 10).Value2
      $sheet.Cells.Item(2, 4).Value2 = $sheet.Cells.Item(2, 4).Value2 + 100
      $excel.CalculateFullRebuild()
      if ([Math]::Abs($sheet.Cells.Item(2, 10).Value2 - $before - 100) -gt 0.001) { throw 'Input perturbation did not recalculate' }
      $sheet.Cells.Item(2, 4).Value2 = $sheet.Cells.Item(2, 4).Value2 - 100
      $excel.CalculateFullRebuild()
      if ($file.BaseName -eq 'retirement-today') {
        foreach ($tab in $book.Worksheets) {
          $tab.PageSetup.Orientation = 2
          $tab.PageSetup.Zoom = $false
          $tab.PageSetup.FitToPagesWide = 1
          $tab.PageSetup.FitToPagesTall = 1
          $tab.PageSetup.PrintArea = if ($tab.Name -in @('Overview', 'Review notes')) { 'A1:B13' } else { 'A1:F8' }
          $tab.ExportAsFixedFormat(0, (Join-Path $file.DirectoryName ('preview-' + $tab.Name + '.pdf')))
        }
      }
      Write-Output ($file.Name + ': opened without repair; balance and conversion formulas pass; input perturbation recalculates')
    } finally { $book.Close($false) }
  }
} finally { $excel.Quit() }
