$ErrorActionPreference = 'Stop'
$excel = New-Object -ComObject Excel.Application
$excel.Visible = $false
$excel.DisplayAlerts = $false
try {
  foreach ($file in Get-ChildItem 'outputs/calculation-support/growth' -Filter '*.xlsx') {
    $book = $excel.Workbooks.Open($file.FullName, 0, $true)
    try {
      $excel.CalculateFullRebuild()
      $annual = $book.Worksheets.Item('Annual balances')
      $values = $annual.UsedRange.Value2
      for ($i = 2; $i -le $values.GetLength(0); $i++) { if ([Math]::Abs($values[$i, 11]) -gt .00001) { throw "Annual mismatch $i" } }
      $converted = $book.Worksheets.Item('Dollar conversion').UsedRange.Value2
      for ($i = 2; $i -le $converted.GetLength(0); $i++) {
        $expected = $converted[$i, 4] / [Math]::Pow(1 + $converted[$i, 5], $converted[$i, 2])
        if ([Math]::Abs($converted[$i, 6] - $expected) -gt .00001) { throw "Conversion mismatch $i" }
      }
      $before = $annual.Cells.Item(2, 9).Value2
      $annual.Cells.Item(2, 4).Value2 = $annual.Cells.Item(2, 4).Value2 + 100
      $excel.CalculateFullRebuild()
      if ([Math]::Abs($annual.Cells.Item(2, 9).Value2 - $before - 100) -gt .00001) { throw 'Recalculation failed' }
      $annual.Cells.Item(2, 4).Value2 = $annual.Cells.Item(2, 4).Value2 - 100
      if ($file.BaseName -eq 'growth-today') {
        foreach ($tab in $book.Worksheets) {
          $tab.PageSetup.Orientation = 2; $tab.PageSetup.Zoom = $false
          $tab.PageSetup.FitToPagesWide = 1; $tab.PageSetup.FitToPagesTall = 1
          $tab.PageSetup.PrintArea = if ($tab.Name -in @('Overview', 'Review notes')) { 'A1:B13' } else { 'A1:F8' }
          $tab.ExportAsFixedFormat(0, (Join-Path $file.DirectoryName ('preview-' + $tab.Name + '.pdf')))
        }
      }
      Write-Output ($file.Name + ': opens without repair; annual totals, real conversion and input perturbation pass')
    } finally { $book.Close($false) }
  }
} finally { $excel.Quit() }
