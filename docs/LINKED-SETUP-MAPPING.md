# Linked setup field mapping

## Rental property

The guided editor writes one canonical asset, one rental income item and, when selected, one rental property liability. Existing records are updated by stable ID.

| Guided field | Model field |
| --- | --- |
| Property name / description | `assetItems[].name`, `incomeItems[].propertyName` |
| Current property value | `assetItems[].value` |
| Owner and percentages | `owner`, `person1AllocationPercentage`, `person2AllocationPercentage` on the asset and income; loan owner follows the asset |
| Annual rent received | `incomeItems[].annualRentReceived` |
| Annual property expenses excluding principal | `incomeItems[].annualPropertyExpensesExcludingPrincipal` |
| Calculated rental cash income | `annualRentReceived - annualPropertyExpensesExcludingPrincipal`, stored in `incomeItems[].rentalCashIncomeAnnual` |
| Taxable rental profit | Separate optional advanced value in `incomeItems[].amount` |
| Cashflow treatment | `incomeItems[].rentalCashflowTreatment`; defaults to `afterInterest` |
| Loan fields | `liabilityItems[].balance`, `interestRatePct`, `repayment`, `repaymentFrequency`, `termYears`, `openingOffsetBalance` |

The ordinary guided flow expects property expenses to include relevant operating costs and loan interest but exclude principal. The existing after-interest calculation therefore deducts linked loan principal from rental cash income and does not deduct interest a second time. The before-interest option remains available under advanced details for records whose cash input excludes interest.

Cross-links are written as `income.linkedAssetId`, `income.linkedLoanIds`, `loan.linkedAssetId`, `loan.linkedRentalIncomeId` and `loan.investmentLink`. Turning off an existing loan requires an explicit choice. Unlinking clears links but retains the liability.

## Shares and investments

| Guided field | Model field |
| --- | --- |
| Investment name / description | `assetItems[].name`, used to derive the income and loan labels |
| Investment type | `assetItems[].investmentType`; shares/ETF use category `shares`, managed funds use `managedFund`, other investments use `other` |
| Current value | `assetItems[].value` |
| Owner and percentages | `owner`, `person1AllocationPercentage`, `person2AllocationPercentage` on the asset and income; loan owner follows the asset |
| Annual dividends / distributions | `incomeItems[].amount`, frequency `annually` |
| Income category | Shares/ETF use `dividends`; managed fund/other use `distributions` |
| Loan fields | An `investmentLoan` liability with the existing balance, rate, repayment, frequency and term fields |

Cross-links are written as `income.linkedAssetId`, `loan.linkedAssetId`, `loan.linkedInvestmentIncomeId` and `loan.investmentLink`.

## Persistence and compatibility

The editor holds changes in a draft until Save. It builds all linked records on a cloned plan and commits them through the existing R5 storage coordinator in one plan write. If persistence fails, the previous in-memory plan is restored and the existing storage recovery guidance is shown. There is no direct `localStorage` write fallback.

Legacy records are not migrated or deleted. Records with explicit stable links can be opened in the consolidated editor. Unlinked or ambiguous records remain available through the existing manual Financial Plan cards and are never linked by matching names.
