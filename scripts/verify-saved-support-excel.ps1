$ErrorActionPreference = 'Stop'
$excel = New-Object -ComObject Excel.Application
$excel.Visible = $false; $excel.DisplayAlerts = $false
try {
  foreach ($file in Get-ChildItem 'outputs/calculation-support/saved' -Filter '*.xlsx') {
    $book = $excel.Workbooks.Open($file.FullName, 0, $true)
    try {
      $excel.CalculateFullRebuild()
      $sheet = $book.Worksheets.Item('Comparison'); $values = $sheet.UsedRange.Value2
      $checked = 0
      for ($i = 2; $i -le $values.GetLength(0); $i++) {
        if ($values[$i, 5] -is [double] -and $values[$i, 6] -is [double]) {
          if ([Math]::Abs($values[$i, 7] - ($values[$i, 6] - $values[$i, 5])) -gt .00001) { throw "Difference mismatch $i" }; $checked++
        }
      }
      if ($checked -lt 3) { throw 'Missing numerical comparison coverage' }
      $converted = $book.Worksheets.Item('Dollar conversion').UsedRange.Value2
      for ($i = 2; $i -le $converted.GetLength(0); $i++) { if ([Math]::Abs($converted[$i, 9]) -gt .00001) { throw "Conversion mismatch $i" } }
      $before = $sheet.Cells.Item(2, 7).Value2
      $sheet.Cells.Item(2, 6).Value2 = $sheet.Cells.Item(2, 6).Value2 + 100
      $excel.CalculateFullRebuild()
      if ([Math]::Abs($sheet.Cells.Item(2, 7).Value2 - $before - 100) -gt .00001) { throw 'Recalculation failed' }
      $sheet.Cells.Item(2, 6).Value2 = $sheet.Cells.Item(2, 6).Value2 - 100
      if ($file.BaseName -eq 'saved-today') {
        foreach ($tab in $book.Worksheets) {
          $tab.PageSetup.Orientation = 2; $tab.PageSetup.Zoom = $false; $tab.PageSetup.FitToPagesWide = 1; $tab.PageSetup.FitToPagesTall = 1
          $tab.PageSetup.PrintArea = if ($tab.Name -in @('Overview', 'Review notes')) { 'A1:B16' } else { 'A1:F8' }
          $tab.ExportAsFixedFormat(0, (Join-Path $file.DirectoryName ('preview-' + $tab.Name + '.pdf')))
        }
      }
      Write-Output ($file.Name + ': opened without repair; comparison, conversion, missing values and recalculation pass')
    } finally { $book.Close($false) }
  }
} finally { $excel.Quit() }
