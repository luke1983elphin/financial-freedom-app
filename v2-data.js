window.FFS_V2 = {
  "sampleHousehold": {
    "householdName": "James and Sarah",
    "people": [
      {
        "name": "James",
        "age": 42
      },
      {
        "name": "Sarah",
        "age": 41
      }
    ],
    "goals": {
      "workOptionalAge": 50,
      "semiRetirementAge": 55,
      "fullRetirementAge": 60,
      "targetAnnualSpending": 90000
    },
    "assets": [
      {
        "id": "home",
        "name": "Home",
        "category": "home",
        "value": 900000
      },
      {
        "id": "offset",
        "name": "Offset account",
        "category": "offset",
        "value": 90000
      },
      {
        "id": "shares",
        "name": "Shares and ETFs",
        "category": "shares",
        "value": 70000
      },
      {
        "id": "crypto",
        "name": "Crypto",
        "category": "crypto",
        "value": 10000
      },
      {
        "id": "super",
        "name": "Combined super",
        "category": "super",
        "value": 240000
      },
      {
        "id": "vehicles",
        "name": "Vehicles",
        "category": "vehicle",
        "value": 30000
      }
    ],
    "loans": [
      {
        "id": "home-loan",
        "name": "Home loan",
        "type": "homeLoan",
        "principal": 550000,
        "annualInterestRate": 0.061,
        "monthlyRepayment": 3400,
        "termYears": 30,
        "offsetBalance": 90000
      }
    ],
    "incomes": [
      {
        "id": "james-income",
        "name": "James net income",
        "amount": 2400,
        "frequency": "fortnightly"
      },
      {
        "id": "sarah-income",
        "name": "Sarah net income",
        "amount": 2300,
        "frequency": "fortnightly"
      },
      {
        "id": "bonuses",
        "name": "Annual bonuses",
        "amount": 5000,
        "frequency": "annually"
      }
    ],
    "expenses": [
      {
        "id": "living",
        "name": "Living costs",
        "amount": 4000,
        "frequency": "monthly"
      },
      {
        "id": "food",
        "name": "Food",
        "amount": 300,
        "frequency": "weekly"
      },
      {
        "id": "utilities",
        "name": "Utilities",
        "amount": 4000,
        "frequency": "annually"
      },
      {
        "id": "insurance",
        "name": "Insurance",
        "amount": 2500,
        "frequency": "annually"
      },
      {
        "id": "school",
        "name": "School / kids",
        "amount": 3000,
        "frequency": "annually"
      },
      {
        "id": "rates",
        "name": "Rates / property costs",
        "amount": 4000,
        "frequency": "annually"
      }
    ],
    "investing": {
      "annualInvestingTarget": 30000,
      "annualEmployerSuper": 22000,
      "annualExtraSuper": 0
    },
    "assumptions": {
      "modelStartDate": "2026-07-01",
      "expectedInvestmentReturn": 0.08,
      "expectedSuperReturn": 0.08,
      "propertyGrowth": 0.03,
      "inflation": 0.025,
      "safeWithdrawalRate": 0.04,
      "taxRate": 0.345,
      "concessionalSuperTaxRate": 0.15,
      "preservationAge": 60,
      "retirementAge": 60,
      "liquidityPreference": "medium"
    }
  },
  "dashboard": {
    "currentNetWorth": 790000,
    "financialIndependenceAssets": 410000,
    "effectiveMortgageBalance": 460000,
    "annualNetIncome": 127200,
    "annualExpenses": 77100,
    "annualCashSurplus": -20700,
    "wealthCreationRate": 65102.31,
    "financialFreedomScore": 18.2222,
    "loanSummaries": [
      {
        "id": "home-loan",
        "name": "Home loan",
        "type": "homeLoan",
        "schedule": [
          {
            "month": 1,
            "openingBalance": 550000,
            "grossLoanBalance": 550000,
            "offsetBalance": 90000,
            "effectiveLoanBalance": 460000,
            "interestCharged": 2338.33,
            "repayment": 3400,
            "principalRepaid": 1061.67,
            "closingBalance": 548938.33
          },
          {
            "month": 2,
            "openingBalance": 548938.33,
            "grossLoanBalance": 548938.33,
            "offsetBalance": 90000,
            "effectiveLoanBalance": 458938.32999999996,
            "interestCharged": 2332.94,
            "repayment": 3400,
            "principalRepaid": 1067.06,
            "closingBalance": 547871.27
          },
          {
            "month": 3,
            "openingBalance": 547871.27,
            "grossLoanBalance": 547871.27,
            "offsetBalance": 90000,
            "effectiveLoanBalance": 457871.27,
            "interestCharged": 2327.51,
            "repayment": 3400,
            "principalRepaid": 1072.49,
            "closingBalance": 546798.78
          },
          {
            "month": 4,
            "openingBalance": 546798.78,
            "grossLoanBalance": 546798.78,
            "offsetBalance": 90000,
            "effectiveLoanBalance": 456798.78,
            "interestCharged": 2322.06,
            "repayment": 3400,
            "principalRepaid": 1077.94,
            "closingBalance": 545720.84
          },
          {
            "month": 5,
            "openingBalance": 545720.84,
            "grossLoanBalance": 545720.84,
            "offsetBalance": 90000,
            "effectiveLoanBalance": 455720.83999999997,
            "interestCharged": 2316.58,
            "repayment": 3400,
            "principalRepaid": 1083.42,
            "closingBalance": 544637.42
          },
          {
            "month": 6,
            "openingBalance": 544637.42,
            "grossLoanBalance": 544637.42,
            "offsetBalance": 90000,
            "effectiveLoanBalance": 454637.42000000004,
            "interestCharged": 2311.07,
            "repayment": 3400,
            "principalRepaid": 1088.93,
            "closingBalance": 543548.49
          },
          {
            "month": 7,
            "openingBalance": 543548.49,
            "grossLoanBalance": 543548.49,
            "offsetBalance": 90000,
            "effectiveLoanBalance": 453548.49,
            "interestCharged": 2305.54,
            "repayment": 3400,
            "principalRepaid": 1094.46,
            "closingBalance": 542454.03
          },
          {
            "month": 8,
            "openingBalance": 542454.03,
            "grossLoanBalance": 542454.03,
            "offsetBalance": 90000,
            "effectiveLoanBalance": 452454.03,
            "interestCharged": 2299.97,
            "repayment": 3400,
            "principalRepaid": 1100.03,
            "closingBalance": 541354
          },
          {
            "month": 9,
            "openingBalance": 541354,
            "grossLoanBalance": 541354,
            "offsetBalance": 90000,
            "effectiveLoanBalance": 451354,
            "interestCharged": 2294.38,
            "repayment": 3400,
            "principalRepaid": 1105.62,
            "closingBalance": 540248.38
          },
          {
            "month": 10,
            "openingBalance": 540248.38,
            "grossLoanBalance": 540248.38,
            "offsetBalance": 90000,
            "effectiveLoanBalance": 450248.38,
            "interestCharged": 2288.76,
            "repayment": 3400,
            "principalRepaid": 1111.24,
            "closingBalance": 539137.14
          },
          {
            "month": 11,
            "openingBalance": 539137.14,
            "grossLoanBalance": 539137.14,
            "offsetBalance": 90000,
            "effectiveLoanBalance": 449137.14,
            "interestCharged": 2283.11,
            "repayment": 3400,
            "principalRepaid": 1116.89,
            "closingBalance": 538020.25
          },
          {
            "month": 12,
            "openingBalance": 538020.25,
            "grossLoanBalance": 538020.25,
            "offsetBalance": 90000,
            "effectiveLoanBalance": 448020.25,
            "interestCharged": 2277.44,
            "repayment": 3400,
            "principalRepaid": 1122.56,
            "closingBalance": 536897.69
          },
          {
            "month": 13,
            "openingBalance": 536897.69,
            "grossLoanBalance": 536897.69,
            "offsetBalance": 90000,
            "effectiveLoanBalance": 446897.68999999994,
            "interestCharged": 2271.73,
            "repayment": 3400,
            "principalRepaid": 1128.27,
            "closingBalance": 535769.42
          },
          {
            "month": 14,
            "openingBalance": 535769.42,
            "grossLoanBalance": 535769.42,
            "offsetBalance": 90000,
            "effectiveLoanBalance": 445769.42000000004,
            "interestCharged": 2265.99,
            "repayment": 3400,
            "principalRepaid": 1134.01,
            "closingBalance": 534635.41
          },
          {
            "month": 15,
            "openingBalance": 534635.41,
            "grossLoanBalance": 534635.41,
            "offsetBalance": 90000,
            "effectiveLoanBalance": 444635.41000000003,
            "interestCharged": 2260.23,
            "repayment": 3400,
            "principalRepaid": 1139.77,
            "closingBalance": 533495.64
          },
          {
            "month": 16,
            "openingBalance": 533495.64,
            "grossLoanBalance": 533495.64,
            "offsetBalance": 90000,
            "effectiveLoanBalance": 443495.64,
            "interestCharged": 2254.44,
            "repayment": 3400,
            "principalRepaid": 1145.56,
            "closingBalance": 532350.08
          },
          {
            "month": 17,
            "openingBalance": 532350.08,
            "grossLoanBalance": 532350.08,
            "offsetBalance": 90000,
            "effectiveLoanBalance": 442350.07999999996,
            "interestCharged": 2248.61,
            "repayment": 3400,
            "principalRepaid": 1151.39,
            "closingBalance": 531198.69
          },
          {
            "month": 18,
            "openingBalance": 531198.69,
            "grossLoanBalance": 531198.69,
            "offsetBalance": 90000,
            "effectiveLoanBalance": 441198.68999999994,
            "interestCharged": 2242.76,
            "repayment": 3400,
            "principalRepaid": 1157.24,
            "closingBalance": 530041.45
          },
          {
            "month": 19,
            "openingBalance": 530041.45,
            "grossLoanBalance": 530041.45,
            "offsetBalance": 90000,
            "effectiveLoanBalance": 440041.44999999995,
            "interestCharged": 2236.88,
            "repayment": 3400,
            "principalRepaid": 1163.12,
            "closingBalance": 528878.33
          },
          {
            "month": 20,
            "openingBalance": 528878.33,
            "grossLoanBalance": 528878.33,
            "offsetBalance": 90000,
            "effectiveLoanBalance": 438878.32999999996,
            "interestCharged": 2230.96,
            "repayment": 3400,
            "principalRepaid": 1169.04,
            "closingBalance": 527709.29
          },
          {
            "month": 21,
            "openingBalance": 527709.29,
            "grossLoanBalance": 527709.29,
            "offsetBalance": 90000,
            "effectiveLoanBalance": 437709.29000000004,
            "interestCharged": 2225.02,
            "repayment": 3400,
            "principalRepaid": 1174.98,
            "closingBalance": 526534.31
          },
          {
            "month": 22,
            "openingBalance": 526534.31,
            "grossLoanBalance": 526534.31,
            "offsetBalance": 90000,
            "effectiveLoanBalance": 436534.31000000006,
            "interestCharged": 2219.05,
            "repayment": 3400,
            "principalRepaid": 1180.95,
            "closingBalance": 525353.36
          },
          {
            "month": 23,
            "openingBalance": 525353.36,
            "grossLoanBalance": 525353.36,
            "offsetBalance": 90000,
            "effectiveLoanBalance": 435353.36,
            "interestCharged": 2213.05,
            "repayment": 3400,
            "principalRepaid": 1186.95,
            "closingBalance": 524166.41
          },
          {
            "month": 24,
            "openingBalance": 524166.41,
            "grossLoanBalance": 524166.41,
            "offsetBalance": 90000,
            "effectiveLoanBalance": 434166.41,
            "interestCharged": 2207.01,
            "repayment": 3400,
            "principalRepaid": 1192.99,
            "closingBalance": 522973.42
          },
          {
            "month": 25,
            "openingBalance": 522973.42,
            "grossLoanBalance": 522973.42,
            "offsetBalance": 90000,
            "effectiveLoanBalance": 432973.42,
            "interestCharged": 2200.95,
            "repayment": 3400,
            "principalRepaid": 1199.05,
            "closingBalance": 521774.37
          },
          {
            "month": 26,
            "openingBalance": 521774.37,
            "grossLoanBalance": 521774.37,
            "offsetBalance": 90000,
            "effectiveLoanBalance": 431774.37,
            "interestCharged": 2194.85,
            "repayment": 3400,
            "principalRepaid": 1205.15,
            "closingBalance": 520569.22
          },
          {
            "month": 27,
            "openingBalance": 520569.22,
            "grossLoanBalance": 520569.22,
            "offsetBalance": 90000,
            "effectiveLoanBalance": 430569.22,
            "interestCharged": 2188.73,
            "repayment": 3400,
            "principalRepaid": 1211.27,
            "closingBalance": 519357.95
          },
          {
            "month": 28,
            "openingBalance": 519357.95,
            "grossLoanBalance": 519357.95,
            "offsetBalance": 90000,
            "effectiveLoanBalance": 429357.95,
            "interestCharged": 2182.57,
            "repayment": 3400,
            "principalRepaid": 1217.43,
            "closingBalance": 518140.52
          },
          {
            "month": 29,
            "openingBalance": 518140.52,
            "grossLoanBalance": 518140.52,
            "offsetBalance": 90000,
            "effectiveLoanBalance": 428140.52,
            "interestCharged": 2176.38,
            "repayment": 3400,
            "principalRepaid": 1223.62,
            "closingBalance": 516916.9
          },
          {
            "month": 30,
            "openingBalance": 516916.9,
            "grossLoanBalance": 516916.9,
            "offsetBalance": 90000,
            "effectiveLoanBalance": 426916.9,
            "interestCharged": 2170.16,
            "repayment": 3400,
            "principalRepaid": 1229.84,
            "closingBalance": 515687.06
          },
          {
            "month": 31,
            "openingBalance": 515687.06,
            "grossLoanBalance": 515687.06,
            "offsetBalance": 90000,
            "effectiveLoanBalance": 425687.06,
            "interestCharged": 2163.91,
            "repayment": 3400,
            "principalRepaid": 1236.09,
            "closingBalance": 514450.97
          },
          {
            "month": 32,
            "openingBalance": 514450.97,
            "grossLoanBalance": 514450.97,
            "offsetBalance": 90000,
            "effectiveLoanBalance": 424450.97,
            "interestCharged": 2157.63,
            "repayment": 3400,
            "principalRepaid": 1242.37,
            "closingBalance": 513208.6
          },
          {
            "month": 33,
            "openingBalance": 513208.6,
            "grossLoanBalance": 513208.6,
            "offsetBalance": 90000,
            "effectiveLoanBalance": 423208.6,
            "interestCharged": 2151.31,
            "repayment": 3400,
            "principalRepaid": 1248.69,
            "closingBalance": 511959.91
          },
          {
            "month": 34,
            "openingBalance": 511959.91,
            "grossLoanBalance": 511959.91,
            "offsetBalance": 90000,
            "effectiveLoanBalance": 421959.91,
            "interestCharged": 2144.96,
            "repayment": 3400,
            "principalRepaid": 1255.04,
            "closingBalance": 510704.87
          },
          {
            "month": 35,
            "openingBalance": 510704.87,
            "grossLoanBalance": 510704.87,
            "offsetBalance": 90000,
            "effectiveLoanBalance": 420704.87,
            "interestCharged": 2138.58,
            "repayment": 3400,
            "principalRepaid": 1261.42,
            "closingBalance": 509443.45
          },
          {
            "month": 36,
            "openingBalance": 509443.45,
            "grossLoanBalance": 509443.45,
            "offsetBalance": 90000,
            "effectiveLoanBalance": 419443.45,
            "interestCharged": 2132.17,
            "repayment": 3400,
            "principalRepaid": 1267.83,
            "closingBalance": 508175.62
          },
          {
            "month": 37,
            "openingBalance": 508175.62,
            "grossLoanBalance": 508175.62,
            "offsetBalance": 90000,
            "effectiveLoanBalance": 418175.62,
            "interestCharged": 2125.73,
            "repayment": 3400,
            "principalRepaid": 1274.27,
            "closingBalance": 506901.35
          },
          {
            "month": 38,
            "openingBalance": 506901.35,
            "grossLoanBalance": 506901.35,
            "offsetBalance": 90000,
            "effectiveLoanBalance": 416901.35,
            "interestCharged": 2119.25,
            "repayment": 3400,
            "principalRepaid": 1280.75,
            "closingBalance": 505620.6
          },
          {
            "month": 39,
            "openingBalance": 505620.6,
            "grossLoanBalance": 505620.6,
            "offsetBalance": 90000,
            "effectiveLoanBalance": 415620.6,
            "interestCharged": 2112.74,
            "repayment": 3400,
            "principalRepaid": 1287.26,
            "closingBalance": 504333.34
          },
          {
            "month": 40,
            "openingBalance": 504333.34,
            "grossLoanBalance": 504333.34,
            "offsetBalance": 90000,
            "effectiveLoanBalance": 414333.34,
            "interestCharged": 2106.19,
            "repayment": 3400,
            "principalRepaid": 1293.81,
            "closingBalance": 503039.53
          },
          {
            "month": 41,
            "openingBalance": 503039.53,
            "grossLoanBalance": 503039.53,
            "offsetBalance": 90000,
            "effectiveLoanBalance": 413039.53,
            "interestCharged": 2099.62,
            "repayment": 3400,
            "principalRepaid": 1300.38,
            "closingBalance": 501739.15
          },
          {
            "month": 42,
            "openingBalance": 501739.15,
            "grossLoanBalance": 501739.15,
            "offsetBalance": 90000,
            "effectiveLoanBalance": 411739.15,
            "interestCharged": 2093.01,
            "repayment": 3400,
            "principalRepaid": 1306.99,
            "closingBalance": 500432.16
          },
          {
            "month": 43,
            "openingBalance": 500432.16,
            "grossLoanBalance": 500432.16,
            "offsetBalance": 90000,
            "effectiveLoanBalance": 410432.16,
            "interestCharged": 2086.36,
            "repayment": 3400,
            "principalRepaid": 1313.64,
            "closingBalance": 499118.52
          },
          {
            "month": 44,
            "openingBalance": 499118.52,
            "grossLoanBalance": 499118.52,
            "offsetBalance": 90000,
            "effectiveLoanBalance": 409118.52,
            "interestCharged": 2079.69,
            "repayment": 3400,
            "principalRepaid": 1320.31,
            "closingBalance": 497798.21
          },
          {
            "month": 45,
            "openingBalance": 497798.21,
            "grossLoanBalance": 497798.21,
            "offsetBalance": 90000,
            "effectiveLoanBalance": 407798.21,
            "interestCharged": 2072.97,
            "repayment": 3400,
            "principalRepaid": 1327.03,
            "closingBalance": 496471.18
          },
          {
            "month": 46,
            "openingBalance": 496471.18,
            "grossLoanBalance": 496471.18,
            "offsetBalance": 90000,
            "effectiveLoanBalance": 406471.18,
            "interestCharged": 2066.23,
            "repayment": 3400,
            "principalRepaid": 1333.77,
            "closingBalance": 495137.41
          },
          {
            "month": 47,
            "openingBalance": 495137.41,
            "grossLoanBalance": 495137.41,
            "offsetBalance": 90000,
            "effectiveLoanBalance": 405137.41,
            "interestCharged": 2059.45,
            "repayment": 3400,
            "principalRepaid": 1340.55,
            "closingBalance": 493796.86
          },
          {
            "month": 48,
            "openingBalance": 493796.86,
            "grossLoanBalance": 493796.86,
            "offsetBalance": 90000,
            "effectiveLoanBalance": 403796.86,
            "interestCharged": 2052.63,
            "repayment": 3400,
            "principalRepaid": 1347.37,
            "closingBalance": 492449.49
          },
          {
            "month": 49,
            "openingBalance": 492449.49,
            "grossLoanBalance": 492449.49,
            "offsetBalance": 90000,
            "effectiveLoanBalance": 402449.49,
            "interestCharged": 2045.78,
            "repayment": 3400,
            "principalRepaid": 1354.22,
            "closingBalance": 491095.27
          },
          {
            "month": 50,
            "openingBalance": 491095.27,
            "grossLoanBalance": 491095.27,
            "offsetBalance": 90000,
            "effectiveLoanBalance": 401095.27,
            "interestCharged": 2038.9,
            "repayment": 3400,
            "principalRepaid": 1361.1,
            "closingBalance": 489734.17
          },
          {
            "month": 51,
            "openingBalance": 489734.17,
            "grossLoanBalance": 489734.17,
            "offsetBalance": 90000,
            "effectiveLoanBalance": 399734.17,
            "interestCharged": 2031.98,
            "repayment": 3400,
            "principalRepaid": 1368.02,
            "closingBalance": 488366.15
          },
          {
            "month": 52,
            "openingBalance": 488366.15,
            "grossLoanBalance": 488366.15,
            "offsetBalance": 90000,
            "effectiveLoanBalance": 398366.15,
            "interestCharged": 2025.03,
            "repayment": 3400,
            "principalRepaid": 1374.97,
            "closingBalance": 486991.18
          },
          {
            "month": 53,
            "openingBalance": 486991.18,
            "grossLoanBalance": 486991.18,
            "offsetBalance": 90000,
            "effectiveLoanBalance": 396991.18,
            "interestCharged": 2018.04,
            "repayment": 3400,
            "principalRepaid": 1381.96,
            "closingBalance": 485609.22
          },
          {
            "month": 54,
            "openingBalance": 485609.22,
            "grossLoanBalance": 485609.22,
            "offsetBalance": 90000,
            "effectiveLoanBalance": 395609.22,
            "interestCharged": 2011.01,
            "repayment": 3400,
            "principalRepaid": 1388.99,
            "closingBalance": 484220.23
          },
          {
            "month": 55,
            "openingBalance": 484220.23,
            "grossLoanBalance": 484220.23,
            "offsetBalance": 90000,
            "effectiveLoanBalance": 394220.23,
            "interestCharged": 2003.95,
            "repayment": 3400,
            "principalRepaid": 1396.05,
            "closingBalance": 482824.18
          },
          {
            "month": 56,
            "openingBalance": 482824.18,
            "grossLoanBalance": 482824.18,
            "offsetBalance": 90000,
            "effectiveLoanBalance": 392824.18,
            "interestCharged": 1996.86,
            "repayment": 3400,
            "principalRepaid": 1403.14,
            "closingBalance": 481421.04
          },
          {
            "month": 57,
            "openingBalance": 481421.04,
            "grossLoanBalance": 481421.04,
            "offsetBalance": 90000,
            "effectiveLoanBalance": 391421.04,
            "interestCharged": 1989.72,
            "repayment": 3400,
            "principalRepaid": 1410.28,
            "closingBalance": 480010.76
          },
          {
            "month": 58,
            "openingBalance": 480010.76,
            "grossLoanBalance": 480010.76,
            "offsetBalance": 90000,
            "effectiveLoanBalance": 390010.76,
            "interestCharged": 1982.55,
            "repayment": 3400,
            "principalRepaid": 1417.45,
            "closingBalance": 478593.31
          },
          {
            "month": 59,
            "openingBalance": 478593.31,
            "grossLoanBalance": 478593.31,
            "offsetBalance": 90000,
            "effectiveLoanBalance": 388593.31,
            "interestCharged": 1975.35,
            "repayment": 3400,
            "principalRepaid": 1424.65,
            "closingBalance": 477168.66
          },
          {
            "month": 60,
            "openingBalance": 477168.66,
            "grossLoanBalance": 477168.66,
            "offsetBalance": 90000,
            "effectiveLoanBalance": 387168.66,
            "interestCharged": 1968.11,
            "repayment": 3400,
            "principalRepaid": 1431.89,
            "closingBalance": 475736.77
          },
          {
            "month": 61,
            "openingBalance": 475736.77,
            "grossLoanBalance": 475736.77,
            "offsetBalance": 90000,
            "effectiveLoanBalance": 385736.77,
            "interestCharged": 1960.83,
            "repayment": 3400,
            "principalRepaid": 1439.17,
            "closingBalance": 474297.6
          },
          {
            "month": 62,
            "openingBalance": 474297.6,
            "grossLoanBalance": 474297.6,
            "offsetBalance": 90000,
            "effectiveLoanBalance": 384297.6,
            "interestCharged": 1953.51,
            "repayment": 3400,
            "principalRepaid": 1446.49,
            "closingBalance": 472851.11
          },
          {
            "month": 63,
            "openingBalance": 472851.11,
            "grossLoanBalance": 472851.11,
            "offsetBalance": 90000,
            "effectiveLoanBalance": 382851.11,
            "interestCharged": 1946.16,
            "repayment": 3400,
            "principalRepaid": 1453.84,
            "closingBalance": 471397.27
          },
          {
            "month": 64,
            "openingBalance": 471397.27,
            "grossLoanBalance": 471397.27,
            "offsetBalance": 90000,
            "effectiveLoanBalance": 381397.27,
            "interestCharged": 1938.77,
            "repayment": 3400,
            "principalRepaid": 1461.23,
            "closingBalance": 469936.04
          },
          {
            "month": 65,
            "openingBalance": 469936.04,
            "grossLoanBalance": 469936.04,
            "offsetBalance": 90000,
            "effectiveLoanBalance": 379936.04,
            "interestCharged": 1931.34,
            "repayment": 3400,
            "principalRepaid": 1468.66,
            "closingBalance": 468467.38
          },
          {
            "month": 66,
            "openingBalance": 468467.38,
            "grossLoanBalance": 468467.38,
            "offsetBalance": 90000,
            "effectiveLoanBalance": 378467.38,
            "interestCharged": 1923.88,
            "repayment": 3400,
            "principalRepaid": 1476.12,
            "closingBalance": 466991.26
          },
          {
            "month": 67,
            "openingBalance": 466991.26,
            "grossLoanBalance": 466991.26,
            "offsetBalance": 90000,
            "effectiveLoanBalance": 376991.26,
            "interestCharged": 1916.37,
            "repayment": 3400,
            "principalRepaid": 1483.63,
            "closingBalance": 465507.63
          },
          {
            "month": 68,
            "openingBalance": 465507.63,
            "grossLoanBalance": 465507.63,
            "offsetBalance": 90000,
            "effectiveLoanBalance": 375507.63,
            "interestCharged": 1908.83,
            "repayment": 3400,
            "principalRepaid": 1491.17,
            "closingBalance": 464016.46
          },
          {
            "month": 69,
            "openingBalance": 464016.46,
            "grossLoanBalance": 464016.46,
            "offsetBalance": 90000,
            "effectiveLoanBalance": 374016.46,
            "interestCharged": 1901.25,
            "repayment": 3400,
            "principalRepaid": 1498.75,
            "closingBalance": 462517.71
          },
          {
            "month": 70,
            "openingBalance": 462517.71,
            "grossLoanBalance": 462517.71,
            "offsetBalance": 90000,
            "effectiveLoanBalance": 372517.71,
            "interestCharged": 1893.63,
            "repayment": 3400,
            "principalRepaid": 1506.37,
            "closingBalance": 461011.34
          },
          {
            "month": 71,
            "openingBalance": 461011.34,
            "grossLoanBalance": 461011.34,
            "offsetBalance": 90000,
            "effectiveLoanBalance": 371011.34,
            "interestCharged": 1885.97,
            "repayment": 3400,
            "principalRepaid": 1514.03,
            "closingBalance": 459497.31
          },
          {
            "month": 72,
            "openingBalance": 459497.31,
            "grossLoanBalance": 459497.31,
            "offsetBalance": 90000,
            "effectiveLoanBalance": 369497.31,
            "interestCharged": 1878.28,
            "repayment": 3400,
            "principalRepaid": 1521.72,
            "closingBalance": 457975.59
          },
          {
            "month": 73,
            "openingBalance": 457975.59,
            "grossLoanBalance": 457975.59,
            "offsetBalance": 90000,
            "effectiveLoanBalance": 367975.59,
            "interestCharged": 1870.54,
            "repayment": 3400,
            "principalRepaid": 1529.46,
            "closingBalance": 456446.13
          },
          {
            "month": 74,
            "openingBalance": 456446.13,
            "grossLoanBalance": 456446.13,
            "offsetBalance": 90000,
            "effectiveLoanBalance": 366446.13,
            "interestCharged": 1862.77,
            "repayment": 3400,
            "principalRepaid": 1537.23,
            "closingBalance": 454908.9
          },
          {
            "month": 75,
            "openingBalance": 454908.9,
            "grossLoanBalance": 454908.9,
            "offsetBalance": 90000,
            "effectiveLoanBalance": 364908.9,
            "interestCharged": 1854.95,
            "repayment": 3400,
            "principalRepaid": 1545.05,
            "closingBalance": 453363.85
          },
          {
            "month": 76,
            "openingBalance": 453363.85,
            "grossLoanBalance": 453363.85,
            "offsetBalance": 90000,
            "effectiveLoanBalance": 363363.85,
            "interestCharged": 1847.1,
            "repayment": 3400,
            "principalRepaid": 1552.9,
            "closingBalance": 451810.95
          },
          {
            "month": 77,
            "openingBalance": 451810.95,
            "grossLoanBalance": 451810.95,
            "offsetBalance": 90000,
            "effectiveLoanBalance": 361810.95,
            "interestCharged": 1839.21,
            "repayment": 3400,
            "principalRepaid": 1560.79,
            "closingBalance": 450250.16
          },
          {
            "month": 78,
            "openingBalance": 450250.16,
            "grossLoanBalance": 450250.16,
            "offsetBalance": 90000,
            "effectiveLoanBalance": 360250.16,
            "interestCharged": 1831.27,
            "repayment": 3400,
            "principalRepaid": 1568.73,
            "closingBalance": 448681.43
          },
          {
            "month": 79,
            "openingBalance": 448681.43,
            "grossLoanBalance": 448681.43,
            "offsetBalance": 90000,
            "effectiveLoanBalance": 358681.43,
            "interestCharged": 1823.3,
            "repayment": 3400,
            "principalRepaid": 1576.7,
            "closingBalance": 447104.73
          },
          {
            "month": 80,
            "openingBalance": 447104.73,
            "grossLoanBalance": 447104.73,
            "offsetBalance": 90000,
            "effectiveLoanBalance": 357104.73,
            "interestCharged": 1815.28,
            "repayment": 3400,
            "principalRepaid": 1584.72,
            "closingBalance": 445520.01
          },
          {
            "month": 81,
            "openingBalance": 445520.01,
            "grossLoanBalance": 445520.01,
            "offsetBalance": 90000,
            "effectiveLoanBalance": 355520.01,
            "interestCharged": 1807.23,
            "repayment": 3400,
            "principalRepaid": 1592.77,
            "closingBalance": 443927.24
          },
          {
            "month": 82,
            "openingBalance": 443927.24,
            "grossLoanBalance": 443927.24,
            "offsetBalance": 90000,
            "effectiveLoanBalance": 353927.24,
            "interestCharged": 1799.13,
            "repayment": 3400,
            "principalRepaid": 1600.87,
            "closingBalance": 442326.37
          },
          {
            "month": 83,
            "openingBalance": 442326.37,
            "grossLoanBalance": 442326.37,
            "offsetBalance": 90000,
            "effectiveLoanBalance": 352326.37,
            "interestCharged": 1790.99,
            "repayment": 3400,
            "principalRepaid": 1609.01,
            "closingBalance": 440717.36
          },
          {
            "month": 84,
            "openingBalance": 440717.36,
            "grossLoanBalance": 440717.36,
            "offsetBalance": 90000,
            "effectiveLoanBalance": 350717.36,
            "interestCharged": 1782.81,
            "repayment": 3400,
            "principalRepaid": 1617.19,
            "closingBalance": 439100.17
          },
          {
            "month": 85,
            "openingBalance": 439100.17,
            "grossLoanBalance": 439100.17,
            "offsetBalance": 90000,
            "effectiveLoanBalance": 349100.17,
            "interestCharged": 1774.59,
            "repayment": 3400,
            "principalRepaid": 1625.41,
            "closingBalance": 437474.76
          },
          {
            "month": 86,
            "openingBalance": 437474.76,
            "grossLoanBalance": 437474.76,
            "offsetBalance": 90000,
            "effectiveLoanBalance": 347474.76,
            "interestCharged": 1766.33,
            "repayment": 3400,
            "principalRepaid": 1633.67,
            "closingBalance": 435841.09
          },
          {
            "month": 87,
            "openingBalance": 435841.09,
            "grossLoanBalance": 435841.09,
            "offsetBalance": 90000,
            "effectiveLoanBalance": 345841.09,
            "interestCharged": 1758.03,
            "repayment": 3400,
            "principalRepaid": 1641.97,
            "closingBalance": 434199.12
          },
          {
            "month": 88,
            "openingBalance": 434199.12,
            "grossLoanBalance": 434199.12,
            "offsetBalance": 90000,
            "effectiveLoanBalance": 344199.12,
            "interestCharged": 1749.68,
            "repayment": 3400,
            "principalRepaid": 1650.32,
            "closingBalance": 432548.8
          },
          {
            "month": 89,
            "openingBalance": 432548.8,
            "grossLoanBalance": 432548.8,
            "offsetBalance": 90000,
            "effectiveLoanBalance": 342548.8,
            "interestCharged": 1741.29,
            "repayment": 3400,
            "principalRepaid": 1658.71,
            "closingBalance": 430890.09
          },
          {
            "month": 90,
            "openingBalance": 430890.09,
            "grossLoanBalance": 430890.09,
            "offsetBalance": 90000,
            "effectiveLoanBalance": 340890.09,
            "interestCharged": 1732.86,
            "repayment": 3400,
            "principalRepaid": 1667.14,
            "closingBalance": 429222.95
          },
          {
            "month": 91,
            "openingBalance": 429222.95,
            "grossLoanBalance": 429222.95,
            "offsetBalance": 90000,
            "effectiveLoanBalance": 339222.95,
            "interestCharged": 1724.38,
            "repayment": 3400,
            "principalRepaid": 1675.62,
            "closingBalance": 427547.33
          },
          {
            "month": 92,
            "openingBalance": 427547.33,
            "grossLoanBalance": 427547.33,
            "offsetBalance": 90000,
            "effectiveLoanBalance": 337547.33,
            "interestCharged": 1715.87,
            "repayment": 3400,
            "principalRepaid": 1684.13,
            "closingBalance": 425863.2
          },
          {
            "month": 93,
            "openingBalance": 425863.2,
            "grossLoanBalance": 425863.2,
            "offsetBalance": 90000,
            "effectiveLoanBalance": 335863.2,
            "interestCharged": 1707.3,
            "repayment": 3400,
            "principalRepaid": 1692.7,
            "closingBalance": 424170.5
          },
          {
            "month": 94,
            "openingBalance": 424170.5,
            "grossLoanBalance": 424170.5,
            "offsetBalance": 90000,
            "effectiveLoanBalance": 334170.5,
            "interestCharged": 1698.7,
            "repayment": 3400,
            "principalRepaid": 1701.3,
            "closingBalance": 422469.2
          },
          {
            "month": 95,
            "openingBalance": 422469.2,
            "grossLoanBalance": 422469.2,
            "offsetBalance": 90000,
            "effectiveLoanBalance": 332469.2,
            "interestCharged": 1690.05,
            "repayment": 3400,
            "principalRepaid": 1709.95,
            "closingBalance": 420759.25
          },
          {
            "month": 96,
            "openingBalance": 420759.25,
            "grossLoanBalance": 420759.25,
            "offsetBalance": 90000,
            "effectiveLoanBalance": 330759.25,
            "interestCharged": 1681.36,
            "repayment": 3400,
            "principalRepaid": 1718.64,
            "closingBalance": 419040.61
          },
          {
            "month": 97,
            "openingBalance": 419040.61,
            "grossLoanBalance": 419040.61,
            "offsetBalance": 90000,
            "effectiveLoanBalance": 329040.61,
            "interestCharged": 1672.62,
            "repayment": 3400,
            "principalRepaid": 1727.38,
            "closingBalance": 417313.23
          },
          {
            "month": 98,
            "openingBalance": 417313.23,
            "grossLoanBalance": 417313.23,
            "offsetBalance": 90000,
            "effectiveLoanBalance": 327313.23,
            "interestCharged": 1663.84,
            "repayment": 3400,
            "principalRepaid": 1736.16,
            "closingBalance": 415577.07
          },
          {
            "month": 99,
            "openingBalance": 415577.07,
            "grossLoanBalance": 415577.07,
            "offsetBalance": 90000,
            "effectiveLoanBalance": 325577.07,
            "interestCharged": 1655.02,
            "repayment": 3400,
            "principalRepaid": 1744.98,
            "closingBalance": 413832.09
          },
          {
            "month": 100,
            "openingBalance": 413832.09,
            "grossLoanBalance": 413832.09,
            "offsetBalance": 90000,
            "effectiveLoanBalance": 323832.09,
            "interestCharged": 1646.15,
            "repayment": 3400,
            "principalRepaid": 1753.85,
            "closingBalance": 412078.24
          },
          {
            "month": 101,
            "openingBalance": 412078.24,
            "grossLoanBalance": 412078.24,
            "offsetBalance": 90000,
            "effectiveLoanBalance": 322078.24,
            "interestCharged": 1637.23,
            "repayment": 3400,
            "principalRepaid": 1762.77,
            "closingBalance": 410315.47
          },
          {
            "month": 102,
            "openingBalance": 410315.47,
            "grossLoanBalance": 410315.47,
            "offsetBalance": 90000,
            "effectiveLoanBalance": 320315.47,
            "interestCharged": 1628.27,
            "repayment": 3400,
            "principalRepaid": 1771.73,
            "closingBalance": 408543.74
          },
          {
            "month": 103,
            "openingBalance": 408543.74,
            "grossLoanBalance": 408543.74,
            "offsetBalance": 90000,
            "effectiveLoanBalance": 318543.74,
            "interestCharged": 1619.26,
            "repayment": 3400,
            "principalRepaid": 1780.74,
            "closingBalance": 406763
          },
          {
            "month": 104,
            "openingBalance": 406763,
            "grossLoanBalance": 406763,
            "offsetBalance": 90000,
            "effectiveLoanBalance": 316763,
            "interestCharged": 1610.21,
            "repayment": 3400,
            "principalRepaid": 1789.79,
            "closingBalance": 404973.21
          },
          {
            "month": 105,
            "openingBalance": 404973.21,
            "grossLoanBalance": 404973.21,
            "offsetBalance": 90000,
            "effectiveLoanBalance": 314973.21,
            "interestCharged": 1601.11,
            "repayment": 3400,
            "principalRepaid": 1798.89,
            "closingBalance": 403174.32
          },
          {
            "month": 106,
            "openingBalance": 403174.32,
            "grossLoanBalance": 403174.32,
            "offsetBalance": 90000,
            "effectiveLoanBalance": 313174.32,
            "interestCharged": 1591.97,
            "repayment": 3400,
            "principalRepaid": 1808.03,
            "closingBalance": 401366.29
          },
          {
            "month": 107,
            "openingBalance": 401366.29,
            "grossLoanBalance": 401366.29,
            "offsetBalance": 90000,
            "effectiveLoanBalance": 311366.29,
            "interestCharged": 1582.78,
            "repayment": 3400,
            "principalRepaid": 1817.22,
            "closingBalance": 399549.07
          },
          {
            "month": 108,
            "openingBalance": 399549.07,
            "grossLoanBalance": 399549.07,
            "offsetBalance": 90000,
            "effectiveLoanBalance": 309549.07,
            "interestCharged": 1573.54,
            "repayment": 3400,
            "principalRepaid": 1826.46,
            "closingBalance": 397722.61
          },
          {
            "month": 109,
            "openingBalance": 397722.61,
            "grossLoanBalance": 397722.61,
            "offsetBalance": 90000,
            "effectiveLoanBalance": 307722.61,
            "interestCharged": 1564.26,
            "repayment": 3400,
            "principalRepaid": 1835.74,
            "closingBalance": 395886.87
          },
          {
            "month": 110,
            "openingBalance": 395886.87,
            "grossLoanBalance": 395886.87,
            "offsetBalance": 90000,
            "effectiveLoanBalance": 305886.87,
            "interestCharged": 1554.92,
            "repayment": 3400,
            "principalRepaid": 1845.08,
            "closingBalance": 394041.79
          },
          {
            "month": 111,
            "openingBalance": 394041.79,
            "grossLoanBalance": 394041.79,
            "offsetBalance": 90000,
            "effectiveLoanBalance": 304041.79,
            "interestCharged": 1545.55,
            "repayment": 3400,
            "principalRepaid": 1854.45,
            "closingBalance": 392187.34
          },
          {
            "month": 112,
            "openingBalance": 392187.34,
            "grossLoanBalance": 392187.34,
            "offsetBalance": 90000,
            "effectiveLoanBalance": 302187.34,
            "interestCharged": 1536.12,
            "repayment": 3400,
            "principalRepaid": 1863.88,
            "closingBalance": 390323.46
          },
          {
            "month": 113,
            "openingBalance": 390323.46,
            "grossLoanBalance": 390323.46,
            "offsetBalance": 90000,
            "effectiveLoanBalance": 300323.46,
            "interestCharged": 1526.64,
            "repayment": 3400,
            "principalRepaid": 1873.36,
            "closingBalance": 388450.1
          },
          {
            "month": 114,
            "openingBalance": 388450.1,
            "grossLoanBalance": 388450.1,
            "offsetBalance": 90000,
            "effectiveLoanBalance": 298450.1,
            "interestCharged": 1517.12,
            "repayment": 3400,
            "principalRepaid": 1882.88,
            "closingBalance": 386567.22
          },
          {
            "month": 115,
            "openingBalance": 386567.22,
            "grossLoanBalance": 386567.22,
            "offsetBalance": 90000,
            "effectiveLoanBalance": 296567.22,
            "interestCharged": 1507.55,
            "repayment": 3400,
            "principalRepaid": 1892.45,
            "closingBalance": 384674.77
          },
          {
            "month": 116,
            "openingBalance": 384674.77,
            "grossLoanBalance": 384674.77,
            "offsetBalance": 90000,
            "effectiveLoanBalance": 294674.77,
            "interestCharged": 1497.93,
            "repayment": 3400,
            "principalRepaid": 1902.07,
            "closingBalance": 382772.7
          },
          {
            "month": 117,
            "openingBalance": 382772.7,
            "grossLoanBalance": 382772.7,
            "offsetBalance": 90000,
            "effectiveLoanBalance": 292772.7,
            "interestCharged": 1488.26,
            "repayment": 3400,
            "principalRepaid": 1911.74,
            "closingBalance": 380860.96
          },
          {
            "month": 118,
            "openingBalance": 380860.96,
            "grossLoanBalance": 380860.96,
            "offsetBalance": 90000,
            "effectiveLoanBalance": 290860.96,
            "interestCharged": 1478.54,
            "repayment": 3400,
            "principalRepaid": 1921.46,
            "closingBalance": 378939.5
          },
          {
            "month": 119,
            "openingBalance": 378939.5,
            "grossLoanBalance": 378939.5,
            "offsetBalance": 90000,
            "effectiveLoanBalance": 288939.5,
            "interestCharged": 1468.78,
            "repayment": 3400,
            "principalRepaid": 1931.22,
            "closingBalance": 377008.28
          },
          {
            "month": 120,
            "openingBalance": 377008.28,
            "grossLoanBalance": 377008.28,
            "offsetBalance": 90000,
            "effectiveLoanBalance": 287008.28,
            "interestCharged": 1458.96,
            "repayment": 3400,
            "principalRepaid": 1941.04,
            "closingBalance": 375067.24
          },
          {
            "month": 121,
            "openingBalance": 375067.24,
            "grossLoanBalance": 375067.24,
            "offsetBalance": 90000,
            "effectiveLoanBalance": 285067.24,
            "interestCharged": 1449.09,
            "repayment": 3400,
            "principalRepaid": 1950.91,
            "closingBalance": 373116.33
          },
          {
            "month": 122,
            "openingBalance": 373116.33,
            "grossLoanBalance": 373116.33,
            "offsetBalance": 90000,
            "effectiveLoanBalance": 283116.33,
            "interestCharged": 1439.17,
            "repayment": 3400,
            "principalRepaid": 1960.83,
            "closingBalance": 371155.5
          },
          {
            "month": 123,
            "openingBalance": 371155.5,
            "grossLoanBalance": 371155.5,
            "offsetBalance": 90000,
            "effectiveLoanBalance": 281155.5,
            "interestCharged": 1429.21,
            "repayment": 3400,
            "principalRepaid": 1970.79,
            "closingBalance": 369184.71
          },
          {
            "month": 124,
            "openingBalance": 369184.71,
            "grossLoanBalance": 369184.71,
            "offsetBalance": 90000,
            "effectiveLoanBalance": 279184.71,
            "interestCharged": 1419.19,
            "repayment": 3400,
            "principalRepaid": 1980.81,
            "closingBalance": 367203.9
          },
          {
            "month": 125,
            "openingBalance": 367203.9,
            "grossLoanBalance": 367203.9,
            "offsetBalance": 90000,
            "effectiveLoanBalance": 277203.9,
            "interestCharged": 1409.12,
            "repayment": 3400,
            "principalRepaid": 1990.88,
            "closingBalance": 365213.02
          },
          {
            "month": 126,
            "openingBalance": 365213.02,
            "grossLoanBalance": 365213.02,
            "offsetBalance": 90000,
            "effectiveLoanBalance": 275213.02,
            "interestCharged": 1399,
            "repayment": 3400,
            "principalRepaid": 2001,
            "closingBalance": 363212.02
          },
          {
            "month": 127,
            "openingBalance": 363212.02,
            "grossLoanBalance": 363212.02,
            "offsetBalance": 90000,
            "effectiveLoanBalance": 273212.02,
            "interestCharged": 1388.83,
            "repayment": 3400,
            "principalRepaid": 2011.17,
            "closingBalance": 361200.85
          },
          {
            "month": 128,
            "openingBalance": 361200.85,
            "grossLoanBalance": 361200.85,
            "offsetBalance": 90000,
            "effectiveLoanBalance": 271200.85,
            "interestCharged": 1378.6,
            "repayment": 3400,
            "principalRepaid": 2021.4,
            "closingBalance": 359179.45
          },
          {
            "month": 129,
            "openingBalance": 359179.45,
            "grossLoanBalance": 359179.45,
            "offsetBalance": 90000,
            "effectiveLoanBalance": 269179.45,
            "interestCharged": 1368.33,
            "repayment": 3400,
            "principalRepaid": 2031.67,
            "closingBalance": 357147.78
          },
          {
            "month": 130,
            "openingBalance": 357147.78,
            "grossLoanBalance": 357147.78,
            "offsetBalance": 90000,
            "effectiveLoanBalance": 267147.78,
            "interestCharged": 1358,
            "repayment": 3400,
            "principalRepaid": 2042,
            "closingBalance": 355105.78
          },
          {
            "month": 131,
            "openingBalance": 355105.78,
            "grossLoanBalance": 355105.78,
            "offsetBalance": 90000,
            "effectiveLoanBalance": 265105.78,
            "interestCharged": 1347.62,
            "repayment": 3400,
            "principalRepaid": 2052.38,
            "closingBalance": 353053.4
          },
          {
            "month": 132,
            "openingBalance": 353053.4,
            "grossLoanBalance": 353053.4,
            "offsetBalance": 90000,
            "effectiveLoanBalance": 263053.4,
            "interestCharged": 1337.19,
            "repayment": 3400,
            "principalRepaid": 2062.81,
            "closingBalance": 350990.59
          },
          {
            "month": 133,
            "openingBalance": 350990.59,
            "grossLoanBalance": 350990.59,
            "offsetBalance": 90000,
            "effectiveLoanBalance": 260990.59000000003,
            "interestCharged": 1326.7,
            "repayment": 3400,
            "principalRepaid": 2073.3,
            "closingBalance": 348917.29
          },
          {
            "month": 134,
            "openingBalance": 348917.29,
            "grossLoanBalance": 348917.29,
            "offsetBalance": 90000,
            "effectiveLoanBalance": 258917.28999999998,
            "interestCharged": 1316.16,
            "repayment": 3400,
            "principalRepaid": 2083.84,
            "closingBalance": 346833.45
          },
          {
            "month": 135,
            "openingBalance": 346833.45,
            "grossLoanBalance": 346833.45,
            "offsetBalance": 90000,
            "effectiveLoanBalance": 256833.45,
            "interestCharged": 1305.57,
            "repayment": 3400,
            "principalRepaid": 2094.43,
            "closingBalance": 344739.02
          },
          {
            "month": 136,
            "openingBalance": 344739.02,
            "grossLoanBalance": 344739.02,
            "offsetBalance": 90000,
            "effectiveLoanBalance": 254739.02000000002,
            "interestCharged": 1294.92,
            "repayment": 3400,
            "principalRepaid": 2105.08,
            "closingBalance": 342633.94
          },
          {
            "month": 137,
            "openingBalance": 342633.94,
            "grossLoanBalance": 342633.94,
            "offsetBalance": 90000,
            "effectiveLoanBalance": 252633.94,
            "interestCharged": 1284.22,
            "repayment": 3400,
            "principalRepaid": 2115.78,
            "closingBalance": 340518.16
          },
          {
            "month": 138,
            "openingBalance": 340518.16,
            "grossLoanBalance": 340518.16,
            "offsetBalance": 90000,
            "effectiveLoanBalance": 250518.15999999997,
            "interestCharged": 1273.47,
            "repayment": 3400,
            "principalRepaid": 2126.53,
            "closingBalance": 338391.63
          },
          {
            "month": 139,
            "openingBalance": 338391.63,
            "grossLoanBalance": 338391.63,
            "offsetBalance": 90000,
            "effectiveLoanBalance": 248391.63,
            "interestCharged": 1262.66,
            "repayment": 3400,
            "principalRepaid": 2137.34,
            "closingBalance": 336254.29
          },
          {
            "month": 140,
            "openingBalance": 336254.29,
            "grossLoanBalance": 336254.29,
            "offsetBalance": 90000,
            "effectiveLoanBalance": 246254.28999999998,
            "interestCharged": 1251.79,
            "repayment": 3400,
            "principalRepaid": 2148.21,
            "closingBalance": 334106.08
          },
          {
            "month": 141,
            "openingBalance": 334106.08,
            "grossLoanBalance": 334106.08,
            "offsetBalance": 90000,
            "effectiveLoanBalance": 244106.08000000002,
            "interestCharged": 1240.87,
            "repayment": 3400,
            "principalRepaid": 2159.13,
            "closingBalance": 331946.95
          },
          {
            "month": 142,
            "openingBalance": 331946.95,
            "grossLoanBalance": 331946.95,
            "offsetBalance": 90000,
            "effectiveLoanBalance": 241946.95,
            "interestCharged": 1229.9,
            "repayment": 3400,
            "principalRepaid": 2170.1,
            "closingBalance": 329776.85
          },
          {
            "month": 143,
            "openingBalance": 329776.85,
            "grossLoanBalance": 329776.85,
            "offsetBalance": 90000,
            "effectiveLoanBalance": 239776.84999999998,
            "interestCharged": 1218.87,
            "repayment": 3400,
            "principalRepaid": 2181.13,
            "closingBalance": 327595.72
          },
          {
            "month": 144,
            "openingBalance": 327595.72,
            "grossLoanBalance": 327595.72,
            "offsetBalance": 90000,
            "effectiveLoanBalance": 237595.71999999997,
            "interestCharged": 1207.78,
            "repayment": 3400,
            "principalRepaid": 2192.22,
            "closingBalance": 325403.5
          },
          {
            "month": 145,
            "openingBalance": 325403.5,
            "grossLoanBalance": 325403.5,
            "offsetBalance": 90000,
            "effectiveLoanBalance": 235403.5,
            "interestCharged": 1196.63,
            "repayment": 3400,
            "principalRepaid": 2203.37,
            "closingBalance": 323200.13
          },
          {
            "month": 146,
            "openingBalance": 323200.13,
            "grossLoanBalance": 323200.13,
            "offsetBalance": 90000,
            "effectiveLoanBalance": 233200.13,
            "interestCharged": 1185.43,
            "repayment": 3400,
            "principalRepaid": 2214.57,
            "closingBalance": 320985.56
          },
          {
            "month": 147,
            "openingBalance": 320985.56,
            "grossLoanBalance": 320985.56,
            "offsetBalance": 90000,
            "effectiveLoanBalance": 230985.56,
            "interestCharged": 1174.18,
            "repayment": 3400,
            "principalRepaid": 2225.82,
            "closingBalance": 318759.74
          },
          {
            "month": 148,
            "openingBalance": 318759.74,
            "grossLoanBalance": 318759.74,
            "offsetBalance": 90000,
            "effectiveLoanBalance": 228759.74,
            "interestCharged": 1162.86,
            "repayment": 3400,
            "principalRepaid": 2237.14,
            "closingBalance": 316522.6
          },
          {
            "month": 149,
            "openingBalance": 316522.6,
            "grossLoanBalance": 316522.6,
            "offsetBalance": 90000,
            "effectiveLoanBalance": 226522.59999999998,
            "interestCharged": 1151.49,
            "repayment": 3400,
            "principalRepaid": 2248.51,
            "closingBalance": 314274.09
          },
          {
            "month": 150,
            "openingBalance": 314274.09,
            "grossLoanBalance": 314274.09,
            "offsetBalance": 90000,
            "effectiveLoanBalance": 224274.09000000003,
            "interestCharged": 1140.06,
            "repayment": 3400,
            "principalRepaid": 2259.94,
            "closingBalance": 312014.15
          },
          {
            "month": 151,
            "openingBalance": 312014.15,
            "grossLoanBalance": 312014.15,
            "offsetBalance": 90000,
            "effectiveLoanBalance": 222014.15000000002,
            "interestCharged": 1128.57,
            "repayment": 3400,
            "principalRepaid": 2271.43,
            "closingBalance": 309742.72
          },
          {
            "month": 152,
            "openingBalance": 309742.72,
            "grossLoanBalance": 309742.72,
            "offsetBalance": 90000,
            "effectiveLoanBalance": 219742.71999999997,
            "interestCharged": 1117.03,
            "repayment": 3400,
            "principalRepaid": 2282.97,
            "closingBalance": 307459.75
          },
          {
            "month": 153,
            "openingBalance": 307459.75,
            "grossLoanBalance": 307459.75,
            "offsetBalance": 90000,
            "effectiveLoanBalance": 217459.75,
            "interestCharged": 1105.42,
            "repayment": 3400,
            "principalRepaid": 2294.58,
            "closingBalance": 305165.17
          },
          {
            "month": 154,
            "openingBalance": 305165.17,
            "grossLoanBalance": 305165.17,
            "offsetBalance": 90000,
            "effectiveLoanBalance": 215165.16999999998,
            "interestCharged": 1093.76,
            "repayment": 3400,
            "principalRepaid": 2306.24,
            "closingBalance": 302858.93
          },
          {
            "month": 155,
            "openingBalance": 302858.93,
            "grossLoanBalance": 302858.93,
            "offsetBalance": 90000,
            "effectiveLoanBalance": 212858.93,
            "interestCharged": 1082.03,
            "repayment": 3400,
            "principalRepaid": 2317.97,
            "closingBalance": 300540.96
          },
          {
            "month": 156,
            "openingBalance": 300540.96,
            "grossLoanBalance": 300540.96,
            "offsetBalance": 90000,
            "effectiveLoanBalance": 210540.96000000002,
            "interestCharged": 1070.25,
            "repayment": 3400,
            "principalRepaid": 2329.75,
            "closingBalance": 298211.21
          },
          {
            "month": 157,
            "openingBalance": 298211.21,
            "grossLoanBalance": 298211.21,
            "offsetBalance": 90000,
            "effectiveLoanBalance": 208211.21000000002,
            "interestCharged": 1058.41,
            "repayment": 3400,
            "principalRepaid": 2341.59,
            "closingBalance": 295869.62
          },
          {
            "month": 158,
            "openingBalance": 295869.62,
            "grossLoanBalance": 295869.62,
            "offsetBalance": 90000,
            "effectiveLoanBalance": 205869.62,
            "interestCharged": 1046.5,
            "repayment": 3400,
            "principalRepaid": 2353.5,
            "closingBalance": 293516.12
          },
          {
            "month": 159,
            "openingBalance": 293516.12,
            "grossLoanBalance": 293516.12,
            "offsetBalance": 90000,
            "effectiveLoanBalance": 203516.12,
            "interestCharged": 1034.54,
            "repayment": 3400,
            "principalRepaid": 2365.46,
            "closingBalance": 291150.66
          },
          {
            "month": 160,
            "openingBalance": 291150.66,
            "grossLoanBalance": 291150.66,
            "offsetBalance": 90000,
            "effectiveLoanBalance": 201150.65999999997,
            "interestCharged": 1022.52,
            "repayment": 3400,
            "principalRepaid": 2377.48,
            "closingBalance": 288773.18
          },
          {
            "month": 161,
            "openingBalance": 288773.18,
            "grossLoanBalance": 288773.18,
            "offsetBalance": 90000,
            "effectiveLoanBalance": 198773.18,
            "interestCharged": 1010.43,
            "repayment": 3400,
            "principalRepaid": 2389.57,
            "closingBalance": 286383.61
          },
          {
            "month": 162,
            "openingBalance": 286383.61,
            "grossLoanBalance": 286383.61,
            "offsetBalance": 90000,
            "effectiveLoanBalance": 196383.61,
            "interestCharged": 998.28,
            "repayment": 3400,
            "principalRepaid": 2401.72,
            "closingBalance": 283981.89
          },
          {
            "month": 163,
            "openingBalance": 283981.89,
            "grossLoanBalance": 283981.89,
            "offsetBalance": 90000,
            "effectiveLoanBalance": 193981.89,
            "interestCharged": 986.07,
            "repayment": 3400,
            "principalRepaid": 2413.93,
            "closingBalance": 281567.96
          },
          {
            "month": 164,
            "openingBalance": 281567.96,
            "grossLoanBalance": 281567.96,
            "offsetBalance": 90000,
            "effectiveLoanBalance": 191567.96000000002,
            "interestCharged": 973.8,
            "repayment": 3400,
            "principalRepaid": 2426.2,
            "closingBalance": 279141.76
          },
          {
            "month": 165,
            "openingBalance": 279141.76,
            "grossLoanBalance": 279141.76,
            "offsetBalance": 90000,
            "effectiveLoanBalance": 189141.76,
            "interestCharged": 961.47,
            "repayment": 3400,
            "principalRepaid": 2438.53,
            "closingBalance": 276703.23
          },
          {
            "month": 166,
            "openingBalance": 276703.23,
            "grossLoanBalance": 276703.23,
            "offsetBalance": 90000,
            "effectiveLoanBalance": 186703.22999999998,
            "interestCharged": 949.07,
            "repayment": 3400,
            "principalRepaid": 2450.93,
            "closingBalance": 274252.3
          },
          {
            "month": 167,
            "openingBalance": 274252.3,
            "grossLoanBalance": 274252.3,
            "offsetBalance": 90000,
            "effectiveLoanBalance": 184252.3,
            "interestCharged": 936.62,
            "repayment": 3400,
            "principalRepaid": 2463.38,
            "closingBalance": 271788.92
          },
          {
            "month": 168,
            "openingBalance": 271788.92,
            "grossLoanBalance": 271788.92,
            "offsetBalance": 90000,
            "effectiveLoanBalance": 181788.91999999998,
            "interestCharged": 924.09,
            "repayment": 3400,
            "principalRepaid": 2475.91,
            "closingBalance": 269313.01
          },
          {
            "month": 169,
            "openingBalance": 269313.01,
            "grossLoanBalance": 269313.01,
            "offsetBalance": 90000,
            "effectiveLoanBalance": 179313.01,
            "interestCharged": 911.51,
            "repayment": 3400,
            "principalRepaid": 2488.49,
            "closingBalance": 266824.52
          },
          {
            "month": 170,
            "openingBalance": 266824.52,
            "grossLoanBalance": 266824.52,
            "offsetBalance": 90000,
            "effectiveLoanBalance": 176824.52000000002,
            "interestCharged": 898.86,
            "repayment": 3400,
            "principalRepaid": 2501.14,
            "closingBalance": 264323.38
          },
          {
            "month": 171,
            "openingBalance": 264323.38,
            "grossLoanBalance": 264323.38,
            "offsetBalance": 90000,
            "effectiveLoanBalance": 174323.38,
            "interestCharged": 886.14,
            "repayment": 3400,
            "principalRepaid": 2513.86,
            "closingBalance": 261809.52
          },
          {
            "month": 172,
            "openingBalance": 261809.52,
            "grossLoanBalance": 261809.52,
            "offsetBalance": 90000,
            "effectiveLoanBalance": 171809.52,
            "interestCharged": 873.37,
            "repayment": 3400,
            "principalRepaid": 2526.63,
            "closingBalance": 259282.89
          },
          {
            "month": 173,
            "openingBalance": 259282.89,
            "grossLoanBalance": 259282.89,
            "offsetBalance": 90000,
            "effectiveLoanBalance": 169282.89,
            "interestCharged": 860.52,
            "repayment": 3400,
            "principalRepaid": 2539.48,
            "closingBalance": 256743.41
          },
          {
            "month": 174,
            "openingBalance": 256743.41,
            "grossLoanBalance": 256743.41,
            "offsetBalance": 90000,
            "effectiveLoanBalance": 166743.41,
            "interestCharged": 847.61,
            "repayment": 3400,
            "principalRepaid": 2552.39,
            "closingBalance": 254191.02
          },
          {
            "month": 175,
            "openingBalance": 254191.02,
            "grossLoanBalance": 254191.02,
            "offsetBalance": 90000,
            "effectiveLoanBalance": 164191.02,
            "interestCharged": 834.64,
            "repayment": 3400,
            "principalRepaid": 2565.36,
            "closingBalance": 251625.66
          },
          {
            "month": 176,
            "openingBalance": 251625.66,
            "grossLoanBalance": 251625.66,
            "offsetBalance": 90000,
            "effectiveLoanBalance": 161625.66,
            "interestCharged": 821.6,
            "repayment": 3400,
            "principalRepaid": 2578.4,
            "closingBalance": 249047.26
          },
          {
            "month": 177,
            "openingBalance": 249047.26,
            "grossLoanBalance": 249047.26,
            "offsetBalance": 90000,
            "effectiveLoanBalance": 159047.26,
            "interestCharged": 808.49,
            "repayment": 3400,
            "principalRepaid": 2591.51,
            "closingBalance": 246455.75
          },
          {
            "month": 178,
            "openingBalance": 246455.75,
            "grossLoanBalance": 246455.75,
            "offsetBalance": 90000,
            "effectiveLoanBalance": 156455.75,
            "interestCharged": 795.32,
            "repayment": 3400,
            "principalRepaid": 2604.68,
            "closingBalance": 243851.07
          },
          {
            "month": 179,
            "openingBalance": 243851.07,
            "grossLoanBalance": 243851.07,
            "offsetBalance": 90000,
            "effectiveLoanBalance": 153851.07,
            "interestCharged": 782.08,
            "repayment": 3400,
            "principalRepaid": 2617.92,
            "closingBalance": 241233.15
          },
          {
            "month": 180,
            "openingBalance": 241233.15,
            "grossLoanBalance": 241233.15,
            "offsetBalance": 90000,
            "effectiveLoanBalance": 151233.15,
            "interestCharged": 768.77,
            "repayment": 3400,
            "principalRepaid": 2631.23,
            "closingBalance": 238601.92
          },
          {
            "month": 181,
            "openingBalance": 238601.92,
            "grossLoanBalance": 238601.92,
            "offsetBalance": 90000,
            "effectiveLoanBalance": 148601.92,
            "interestCharged": 755.39,
            "repayment": 3400,
            "principalRepaid": 2644.61,
            "closingBalance": 235957.31
          },
          {
            "month": 182,
            "openingBalance": 235957.31,
            "grossLoanBalance": 235957.31,
            "offsetBalance": 90000,
            "effectiveLoanBalance": 145957.31,
            "interestCharged": 741.95,
            "repayment": 3400,
            "principalRepaid": 2658.05,
            "closingBalance": 233299.26
          },
          {
            "month": 183,
            "openingBalance": 233299.26,
            "grossLoanBalance": 233299.26,
            "offsetBalance": 90000,
            "effectiveLoanBalance": 143299.26,
            "interestCharged": 728.44,
            "repayment": 3400,
            "principalRepaid": 2671.56,
            "closingBalance": 230627.7
          },
          {
            "month": 184,
            "openingBalance": 230627.7,
            "grossLoanBalance": 230627.7,
            "offsetBalance": 90000,
            "effectiveLoanBalance": 140627.7,
            "interestCharged": 714.86,
            "repayment": 3400,
            "principalRepaid": 2685.14,
            "closingBalance": 227942.56
          },
          {
            "month": 185,
            "openingBalance": 227942.56,
            "grossLoanBalance": 227942.56,
            "offsetBalance": 90000,
            "effectiveLoanBalance": 137942.56,
            "interestCharged": 701.21,
            "repayment": 3400,
            "principalRepaid": 2698.79,
            "closingBalance": 225243.77
          },
          {
            "month": 186,
            "openingBalance": 225243.77,
            "grossLoanBalance": 225243.77,
            "offsetBalance": 90000,
            "effectiveLoanBalance": 135243.77,
            "interestCharged": 687.49,
            "repayment": 3400,
            "principalRepaid": 2712.51,
            "closingBalance": 222531.26
          },
          {
            "month": 187,
            "openingBalance": 222531.26,
            "grossLoanBalance": 222531.26,
            "offsetBalance": 90000,
            "effectiveLoanBalance": 132531.26,
            "interestCharged": 673.7,
            "repayment": 3400,
            "principalRepaid": 2726.3,
            "closingBalance": 219804.96
          },
          {
            "month": 188,
            "openingBalance": 219804.96,
            "grossLoanBalance": 219804.96,
            "offsetBalance": 90000,
            "effectiveLoanBalance": 129804.95999999999,
            "interestCharged": 659.84,
            "repayment": 3400,
            "principalRepaid": 2740.16,
            "closingBalance": 217064.8
          },
          {
            "month": 189,
            "openingBalance": 217064.8,
            "grossLoanBalance": 217064.8,
            "offsetBalance": 90000,
            "effectiveLoanBalance": 127064.79999999999,
            "interestCharged": 645.91,
            "repayment": 3400,
            "principalRepaid": 2754.09,
            "closingBalance": 214310.71
          },
          {
            "month": 190,
            "openingBalance": 214310.71,
            "grossLoanBalance": 214310.71,
            "offsetBalance": 90000,
            "effectiveLoanBalance": 124310.70999999999,
            "interestCharged": 631.91,
            "repayment": 3400,
            "principalRepaid": 2768.09,
            "closingBalance": 211542.62
          },
          {
            "month": 191,
            "openingBalance": 211542.62,
            "grossLoanBalance": 211542.62,
            "offsetBalance": 90000,
            "effectiveLoanBalance": 121542.62,
            "interestCharged": 617.84,
            "repayment": 3400,
            "principalRepaid": 2782.16,
            "closingBalance": 208760.46
          },
          {
            "month": 192,
            "openingBalance": 208760.46,
            "grossLoanBalance": 208760.46,
            "offsetBalance": 90000,
            "effectiveLoanBalance": 118760.45999999999,
            "interestCharged": 603.7,
            "repayment": 3400,
            "principalRepaid": 2796.3,
            "closingBalance": 205964.16
          },
          {
            "month": 193,
            "openingBalance": 205964.16,
            "grossLoanBalance": 205964.16,
            "offsetBalance": 90000,
            "effectiveLoanBalance": 115964.16,
            "interestCharged": 589.48,
            "repayment": 3400,
            "principalRepaid": 2810.52,
            "closingBalance": 203153.64
          },
          {
            "month": 194,
            "openingBalance": 203153.64,
            "grossLoanBalance": 203153.64,
            "offsetBalance": 90000,
            "effectiveLoanBalance": 113153.64000000001,
            "interestCharged": 575.2,
            "repayment": 3400,
            "principalRepaid": 2824.8,
            "closingBalance": 200328.84
          },
          {
            "month": 195,
            "openingBalance": 200328.84,
            "grossLoanBalance": 200328.84,
            "offsetBalance": 90000,
            "effectiveLoanBalance": 110328.84,
            "interestCharged": 560.84,
            "repayment": 3400,
            "principalRepaid": 2839.16,
            "closingBalance": 197489.68
          },
          {
            "month": 196,
            "openingBalance": 197489.68,
            "grossLoanBalance": 197489.68,
            "offsetBalance": 90000,
            "effectiveLoanBalance": 107489.68,
            "interestCharged": 546.41,
            "repayment": 3400,
            "principalRepaid": 2853.59,
            "closingBalance": 194636.09
          },
          {
            "month": 197,
            "openingBalance": 194636.09,
            "grossLoanBalance": 194636.09,
            "offsetBalance": 90000,
            "effectiveLoanBalance": 104636.09,
            "interestCharged": 531.9,
            "repayment": 3400,
            "principalRepaid": 2868.1,
            "closingBalance": 191767.99
          },
          {
            "month": 198,
            "openingBalance": 191767.99,
            "grossLoanBalance": 191767.99,
            "offsetBalance": 90000,
            "effectiveLoanBalance": 101767.98999999999,
            "interestCharged": 517.32,
            "repayment": 3400,
            "principalRepaid": 2882.68,
            "closingBalance": 188885.31
          },
          {
            "month": 199,
            "openingBalance": 188885.31,
            "grossLoanBalance": 188885.31,
            "offsetBalance": 90000,
            "effectiveLoanBalance": 98885.31,
            "interestCharged": 502.67,
            "repayment": 3400,
            "principalRepaid": 2897.33,
            "closingBalance": 185987.98
          },
          {
            "month": 200,
            "openingBalance": 185987.98,
            "grossLoanBalance": 185987.98,
            "offsetBalance": 90000,
            "effectiveLoanBalance": 95987.98000000001,
            "interestCharged": 487.94,
            "repayment": 3400,
            "principalRepaid": 2912.06,
            "closingBalance": 183075.92
          },
          {
            "month": 201,
            "openingBalance": 183075.92,
            "grossLoanBalance": 183075.92,
            "offsetBalance": 90000,
            "effectiveLoanBalance": 93075.92000000001,
            "interestCharged": 473.14,
            "repayment": 3400,
            "principalRepaid": 2926.86,
            "closingBalance": 180149.06
          },
          {
            "month": 202,
            "openingBalance": 180149.06,
            "grossLoanBalance": 180149.06,
            "offsetBalance": 90000,
            "effectiveLoanBalance": 90149.06,
            "interestCharged": 458.26,
            "repayment": 3400,
            "principalRepaid": 2941.74,
            "closingBalance": 177207.32
          },
          {
            "month": 203,
            "openingBalance": 177207.32,
            "grossLoanBalance": 177207.32,
            "offsetBalance": 90000,
            "effectiveLoanBalance": 87207.32,
            "interestCharged": 443.3,
            "repayment": 3400,
            "principalRepaid": 2956.7,
            "closingBalance": 174250.62
          },
          {
            "month": 204,
            "openingBalance": 174250.62,
            "grossLoanBalance": 174250.62,
            "offsetBalance": 90000,
            "effectiveLoanBalance": 84250.62,
            "interestCharged": 428.27,
            "repayment": 3400,
            "principalRepaid": 2971.73,
            "closingBalance": 171278.89
          },
          {
            "month": 205,
            "openingBalance": 171278.89,
            "grossLoanBalance": 171278.89,
            "offsetBalance": 90000,
            "effectiveLoanBalance": 81278.89000000001,
            "interestCharged": 413.17,
            "repayment": 3400,
            "principalRepaid": 2986.83,
            "closingBalance": 168292.06
          },
          {
            "month": 206,
            "openingBalance": 168292.06,
            "grossLoanBalance": 168292.06,
            "offsetBalance": 90000,
            "effectiveLoanBalance": 78292.06,
            "interestCharged": 397.98,
            "repayment": 3400,
            "principalRepaid": 3002.02,
            "closingBalance": 165290.04
          },
          {
            "month": 207,
            "openingBalance": 165290.04,
            "grossLoanBalance": 165290.04,
            "offsetBalance": 90000,
            "effectiveLoanBalance": 75290.04000000001,
            "interestCharged": 382.72,
            "repayment": 3400,
            "principalRepaid": 3017.28,
            "closingBalance": 162272.76
          },
          {
            "month": 208,
            "openingBalance": 162272.76,
            "grossLoanBalance": 162272.76,
            "offsetBalance": 90000,
            "effectiveLoanBalance": 72272.76000000001,
            "interestCharged": 367.39,
            "repayment": 3400,
            "principalRepaid": 3032.61,
            "closingBalance": 159240.15
          },
          {
            "month": 209,
            "openingBalance": 159240.15,
            "grossLoanBalance": 159240.15,
            "offsetBalance": 90000,
            "effectiveLoanBalance": 69240.15,
            "interestCharged": 351.97,
            "repayment": 3400,
            "principalRepaid": 3048.03,
            "closingBalance": 156192.12
          },
          {
            "month": 210,
            "openingBalance": 156192.12,
            "grossLoanBalance": 156192.12,
            "offsetBalance": 90000,
            "effectiveLoanBalance": 66192.12,
            "interestCharged": 336.48,
            "repayment": 3400,
            "principalRepaid": 3063.52,
            "closingBalance": 153128.6
          },
          {
            "month": 211,
            "openingBalance": 153128.6,
            "grossLoanBalance": 153128.6,
            "offsetBalance": 90000,
            "effectiveLoanBalance": 63128.600000000006,
            "interestCharged": 320.9,
            "repayment": 3400,
            "principalRepaid": 3079.1,
            "closingBalance": 150049.5
          },
          {
            "month": 212,
            "openingBalance": 150049.5,
            "grossLoanBalance": 150049.5,
            "offsetBalance": 90000,
            "effectiveLoanBalance": 60049.5,
            "interestCharged": 305.25,
            "repayment": 3400,
            "principalRepaid": 3094.75,
            "closingBalance": 146954.75
          },
          {
            "month": 213,
            "openingBalance": 146954.75,
            "grossLoanBalance": 146954.75,
            "offsetBalance": 90000,
            "effectiveLoanBalance": 56954.75,
            "interestCharged": 289.52,
            "repayment": 3400,
            "principalRepaid": 3110.48,
            "closingBalance": 143844.27
          },
          {
            "month": 214,
            "openingBalance": 143844.27,
            "grossLoanBalance": 143844.27,
            "offsetBalance": 90000,
            "effectiveLoanBalance": 53844.26999999999,
            "interestCharged": 273.71,
            "repayment": 3400,
            "principalRepaid": 3126.29,
            "closingBalance": 140717.98
          },
          {
            "month": 215,
            "openingBalance": 140717.98,
            "grossLoanBalance": 140717.98,
            "offsetBalance": 90000,
            "effectiveLoanBalance": 50717.98000000001,
            "interestCharged": 257.82,
            "repayment": 3400,
            "principalRepaid": 3142.18,
            "closingBalance": 137575.8
          },
          {
            "month": 216,
            "openingBalance": 137575.8,
            "grossLoanBalance": 137575.8,
            "offsetBalance": 90000,
            "effectiveLoanBalance": 47575.79999999999,
            "interestCharged": 241.84,
            "repayment": 3400,
            "principalRepaid": 3158.16,
            "closingBalance": 134417.64
          },
          {
            "month": 217,
            "openingBalance": 134417.64,
            "grossLoanBalance": 134417.64,
            "offsetBalance": 90000,
            "effectiveLoanBalance": 44417.640000000014,
            "interestCharged": 225.79,
            "repayment": 3400,
            "principalRepaid": 3174.21,
            "closingBalance": 131243.43
          },
          {
            "month": 218,
            "openingBalance": 131243.43,
            "grossLoanBalance": 131243.43,
            "offsetBalance": 90000,
            "effectiveLoanBalance": 41243.42999999999,
            "interestCharged": 209.65,
            "repayment": 3400,
            "principalRepaid": 3190.35,
            "closingBalance": 128053.08
          },
          {
            "month": 219,
            "openingBalance": 128053.08,
            "grossLoanBalance": 128053.08,
            "offsetBalance": 90000,
            "effectiveLoanBalance": 38053.08,
            "interestCharged": 193.44,
            "repayment": 3400,
            "principalRepaid": 3206.56,
            "closingBalance": 124846.52
          },
          {
            "month": 220,
            "openingBalance": 124846.52,
            "grossLoanBalance": 124846.52,
            "offsetBalance": 90000,
            "effectiveLoanBalance": 34846.520000000004,
            "interestCharged": 177.14,
            "repayment": 3400,
            "principalRepaid": 3222.86,
            "closingBalance": 121623.66
          },
          {
            "month": 221,
            "openingBalance": 121623.66,
            "grossLoanBalance": 121623.66,
            "offsetBalance": 90000,
            "effectiveLoanBalance": 31623.660000000003,
            "interestCharged": 160.75,
            "repayment": 3400,
            "principalRepaid": 3239.25,
            "closingBalance": 118384.41
          },
          {
            "month": 222,
            "openingBalance": 118384.41,
            "grossLoanBalance": 118384.41,
            "offsetBalance": 90000,
            "effectiveLoanBalance": 28384.410000000003,
            "interestCharged": 144.29,
            "repayment": 3400,
            "principalRepaid": 3255.71,
            "closingBalance": 115128.7
          },
          {
            "month": 223,
            "openingBalance": 115128.7,
            "grossLoanBalance": 115128.7,
            "offsetBalance": 90000,
            "effectiveLoanBalance": 25128.699999999997,
            "interestCharged": 127.74,
            "repayment": 3400,
            "principalRepaid": 3272.26,
            "closingBalance": 111856.44
          },
          {
            "month": 224,
            "openingBalance": 111856.44,
            "grossLoanBalance": 111856.44,
            "offsetBalance": 90000,
            "effectiveLoanBalance": 21856.440000000002,
            "interestCharged": 111.1,
            "repayment": 3400,
            "principalRepaid": 3288.9,
            "closingBalance": 108567.54
          },
          {
            "month": 225,
            "openingBalance": 108567.54,
            "grossLoanBalance": 108567.54,
            "offsetBalance": 90000,
            "effectiveLoanBalance": 18567.539999999994,
            "interestCharged": 94.38,
            "repayment": 3400,
            "principalRepaid": 3305.62,
            "closingBalance": 105261.92
          },
          {
            "month": 226,
            "openingBalance": 105261.92,
            "grossLoanBalance": 105261.92,
            "offsetBalance": 90000,
            "effectiveLoanBalance": 15261.919999999998,
            "interestCharged": 77.58,
            "repayment": 3400,
            "principalRepaid": 3322.42,
            "closingBalance": 101939.5
          },
          {
            "month": 227,
            "openingBalance": 101939.5,
            "grossLoanBalance": 101939.5,
            "offsetBalance": 90000,
            "effectiveLoanBalance": 11939.5,
            "interestCharged": 60.69,
            "repayment": 3400,
            "principalRepaid": 3339.31,
            "closingBalance": 98600.19
          },
          {
            "month": 228,
            "openingBalance": 98600.19,
            "grossLoanBalance": 98600.19,
            "offsetBalance": 90000,
            "effectiveLoanBalance": 8600.190000000002,
            "interestCharged": 43.72,
            "repayment": 3400,
            "principalRepaid": 3356.28,
            "closingBalance": 95243.91
          },
          {
            "month": 229,
            "openingBalance": 95243.91,
            "grossLoanBalance": 95243.91,
            "offsetBalance": 90000,
            "effectiveLoanBalance": 5243.9100000000035,
            "interestCharged": 26.66,
            "repayment": 3400,
            "principalRepaid": 3373.34,
            "closingBalance": 91870.57
          },
          {
            "month": 230,
            "openingBalance": 91870.57,
            "grossLoanBalance": 91870.57,
            "offsetBalance": 90000,
            "effectiveLoanBalance": 1870.570000000007,
            "interestCharged": 9.51,
            "repayment": 3400,
            "principalRepaid": 3390.49,
            "closingBalance": 88480.08
          },
          {
            "month": 231,
            "openingBalance": 88480.08,
            "grossLoanBalance": 88480.08,
            "offsetBalance": 90000,
            "effectiveLoanBalance": 0,
            "interestCharged": 0,
            "repayment": 3400,
            "principalRepaid": 3400,
            "closingBalance": 85080.08
          },
          {
            "month": 232,
            "openingBalance": 85080.08,
            "grossLoanBalance": 85080.08,
            "offsetBalance": 90000,
            "effectiveLoanBalance": 0,
            "interestCharged": 0,
            "repayment": 3400,
            "principalRepaid": 3400,
            "closingBalance": 81680.08
          },
          {
            "month": 233,
            "openingBalance": 81680.08,
            "grossLoanBalance": 81680.08,
            "offsetBalance": 90000,
            "effectiveLoanBalance": 0,
            "interestCharged": 0,
            "repayment": 3400,
            "principalRepaid": 3400,
            "closingBalance": 78280.08
          },
          {
            "month": 234,
            "openingBalance": 78280.08,
            "grossLoanBalance": 78280.08,
            "offsetBalance": 90000,
            "effectiveLoanBalance": 0,
            "interestCharged": 0,
            "repayment": 3400,
            "principalRepaid": 3400,
            "closingBalance": 74880.08
          },
          {
            "month": 235,
            "openingBalance": 74880.08,
            "grossLoanBalance": 74880.08,
            "offsetBalance": 90000,
            "effectiveLoanBalance": 0,
            "interestCharged": 0,
            "repayment": 3400,
            "principalRepaid": 3400,
            "closingBalance": 71480.08
          },
          {
            "month": 236,
            "openingBalance": 71480.08,
            "grossLoanBalance": 71480.08,
            "offsetBalance": 90000,
            "effectiveLoanBalance": 0,
            "interestCharged": 0,
            "repayment": 3400,
            "principalRepaid": 3400,
            "closingBalance": 68080.08
          },
          {
            "month": 237,
            "openingBalance": 68080.08,
            "grossLoanBalance": 68080.08,
            "offsetBalance": 90000,
            "effectiveLoanBalance": 0,
            "interestCharged": 0,
            "repayment": 3400,
            "principalRepaid": 3400,
            "closingBalance": 64680.08
          },
          {
            "month": 238,
            "openingBalance": 64680.08,
            "grossLoanBalance": 64680.08,
            "offsetBalance": 90000,
            "effectiveLoanBalance": 0,
            "interestCharged": 0,
            "repayment": 3400,
            "principalRepaid": 3400,
            "closingBalance": 61280.08
          },
          {
            "month": 239,
            "openingBalance": 61280.08,
            "grossLoanBalance": 61280.08,
            "offsetBalance": 90000,
            "effectiveLoanBalance": 0,
            "interestCharged": 0,
            "repayment": 3400,
            "principalRepaid": 3400,
            "closingBalance": 57880.08
          },
          {
            "month": 240,
            "openingBalance": 57880.08,
            "grossLoanBalance": 57880.08,
            "offsetBalance": 90000,
            "effectiveLoanBalance": 0,
            "interestCharged": 0,
            "repayment": 3400,
            "principalRepaid": 3400,
            "closingBalance": 54480.08
          },
          {
            "month": 241,
            "openingBalance": 54480.08,
            "grossLoanBalance": 54480.08,
            "offsetBalance": 90000,
            "effectiveLoanBalance": 0,
            "interestCharged": 0,
            "repayment": 3400,
            "principalRepaid": 3400,
            "closingBalance": 51080.08
          },
          {
            "month": 242,
            "openingBalance": 51080.08,
            "grossLoanBalance": 51080.08,
            "offsetBalance": 90000,
            "effectiveLoanBalance": 0,
            "interestCharged": 0,
            "repayment": 3400,
            "principalRepaid": 3400,
            "closingBalance": 47680.08
          },
          {
            "month": 243,
            "openingBalance": 47680.08,
            "grossLoanBalance": 47680.08,
            "offsetBalance": 90000,
            "effectiveLoanBalance": 0,
            "interestCharged": 0,
            "repayment": 3400,
            "principalRepaid": 3400,
            "closingBalance": 44280.08
          },
          {
            "month": 244,
            "openingBalance": 44280.08,
            "grossLoanBalance": 44280.08,
            "offsetBalance": 90000,
            "effectiveLoanBalance": 0,
            "interestCharged": 0,
            "repayment": 3400,
            "principalRepaid": 3400,
            "closingBalance": 40880.08
          },
          {
            "month": 245,
            "openingBalance": 40880.08,
            "grossLoanBalance": 40880.08,
            "offsetBalance": 90000,
            "effectiveLoanBalance": 0,
            "interestCharged": 0,
            "repayment": 3400,
            "principalRepaid": 3400,
            "closingBalance": 37480.08
          },
          {
            "month": 246,
            "openingBalance": 37480.08,
            "grossLoanBalance": 37480.08,
            "offsetBalance": 90000,
            "effectiveLoanBalance": 0,
            "interestCharged": 0,
            "repayment": 3400,
            "principalRepaid": 3400,
            "closingBalance": 34080.08
          },
          {
            "month": 247,
            "openingBalance": 34080.08,
            "grossLoanBalance": 34080.08,
            "offsetBalance": 90000,
            "effectiveLoanBalance": 0,
            "interestCharged": 0,
            "repayment": 3400,
            "principalRepaid": 3400,
            "closingBalance": 30680.08
          },
          {
            "month": 248,
            "openingBalance": 30680.08,
            "grossLoanBalance": 30680.08,
            "offsetBalance": 90000,
            "effectiveLoanBalance": 0,
            "interestCharged": 0,
            "repayment": 3400,
            "principalRepaid": 3400,
            "closingBalance": 27280.08
          },
          {
            "month": 249,
            "openingBalance": 27280.08,
            "grossLoanBalance": 27280.08,
            "offsetBalance": 90000,
            "effectiveLoanBalance": 0,
            "interestCharged": 0,
            "repayment": 3400,
            "principalRepaid": 3400,
            "closingBalance": 23880.08
          },
          {
            "month": 250,
            "openingBalance": 23880.08,
            "grossLoanBalance": 23880.08,
            "offsetBalance": 90000,
            "effectiveLoanBalance": 0,
            "interestCharged": 0,
            "repayment": 3400,
            "principalRepaid": 3400,
            "closingBalance": 20480.08
          },
          {
            "month": 251,
            "openingBalance": 20480.08,
            "grossLoanBalance": 20480.08,
            "offsetBalance": 90000,
            "effectiveLoanBalance": 0,
            "interestCharged": 0,
            "repayment": 3400,
            "principalRepaid": 3400,
            "closingBalance": 17080.08
          },
          {
            "month": 252,
            "openingBalance": 17080.08,
            "grossLoanBalance": 17080.08,
            "offsetBalance": 90000,
            "effectiveLoanBalance": 0,
            "interestCharged": 0,
            "repayment": 3400,
            "principalRepaid": 3400,
            "closingBalance": 13680.08
          },
          {
            "month": 253,
            "openingBalance": 13680.08,
            "grossLoanBalance": 13680.08,
            "offsetBalance": 90000,
            "effectiveLoanBalance": 0,
            "interestCharged": 0,
            "repayment": 3400,
            "principalRepaid": 3400,
            "closingBalance": 10280.08
          },
          {
            "month": 254,
            "openingBalance": 10280.08,
            "grossLoanBalance": 10280.08,
            "offsetBalance": 90000,
            "effectiveLoanBalance": 0,
            "interestCharged": 0,
            "repayment": 3400,
            "principalRepaid": 3400,
            "closingBalance": 6880.08
          },
          {
            "month": 255,
            "openingBalance": 6880.08,
            "grossLoanBalance": 6880.08,
            "offsetBalance": 90000,
            "effectiveLoanBalance": 0,
            "interestCharged": 0,
            "repayment": 3400,
            "principalRepaid": 3400,
            "closingBalance": 3480.08
          },
          {
            "month": 256,
            "openingBalance": 3480.08,
            "grossLoanBalance": 3480.08,
            "offsetBalance": 90000,
            "effectiveLoanBalance": 0,
            "interestCharged": 0,
            "repayment": 3400,
            "principalRepaid": 3400,
            "closingBalance": 80.08
          },
          {
            "month": 257,
            "openingBalance": 80.08,
            "grossLoanBalance": 80.08,
            "offsetBalance": 90000,
            "effectiveLoanBalance": 0,
            "interestCharged": 0,
            "repayment": 80.08,
            "principalRepaid": 80.08,
            "closingBalance": 0
          }
        ],
        "warnings": [],
        "payoffDate": "2047-11-30",
        "yearsToRepay": 21.4167,
        "totalInterestPaid": 320480.08,
        "totalPrincipalRepaid": 550000,
        "totalRepayments": 870480.08,
        "finalBalance": 0,
        "balanceAtYears": {
          "5": 475736.77,
          "10": 375067.24,
          "20": 54480.08,
          "30": 0
        },
        "offsetBenefit": {
          "grossLoanBalance": 550000,
          "offsetBalance": 90000,
          "effectiveLoanBalance": 460000,
          "annualInterestSaved": 5490,
          "taxFreeEquivalentReturn": 0.061
        }
      }
    ],
    "cashflow": {
      "annualNetIncome": 127200,
      "weeklyNetIncome": 2446.15,
      "annualExpenses": 77100,
      "weeklyExpenses": 1482.69,
      "annualMortgageRepayments": 40800,
      "weeklyMortgageRepayments": 784.62,
      "annualInvestmentContributions": 30000,
      "weeklyInvestmentContributions": 576.92,
      "annualEmployerSuper": 22000,
      "annualExtraSuper": 0,
      "cashSurplusBeforeInvesting": 9300,
      "cashSurplusAfterInvesting": -20700
    },
    "investmentProjection": [
      {
        "year": 1,
        "age": 43,
        "openingBalance": 80000,
        "annualContribution": 30000,
        "investmentGrowth": 7972.26,
        "closingBalance": 117972.26,
        "passiveIncome": 4718.89
      },
      {
        "year": 2,
        "age": 44,
        "openingBalance": 117972.26,
        "annualContribution": 30000,
        "investmentGrowth": 11123.96,
        "closingBalance": 159096.22,
        "passiveIncome": 6363.85
      },
      {
        "year": 3,
        "age": 45,
        "openingBalance": 159096.22,
        "annualContribution": 30000,
        "investmentGrowth": 14537.23,
        "closingBalance": 203633.45,
        "passiveIncome": 8145.34
      },
      {
        "year": 4,
        "age": 46,
        "openingBalance": 203633.45,
        "annualContribution": 30000,
        "investmentGrowth": 18233.78,
        "closingBalance": 251867.23,
        "passiveIncome": 10074.69
      },
      {
        "year": 5,
        "age": 47,
        "openingBalance": 251867.23,
        "annualContribution": 30000,
        "investmentGrowth": 22237.16,
        "closingBalance": 304104.39,
        "passiveIncome": 12164.18
      },
      {
        "year": 6,
        "age": 48,
        "openingBalance": 304104.39,
        "annualContribution": 30000,
        "investmentGrowth": 26572.84,
        "closingBalance": 360677.23,
        "passiveIncome": 14427.09
      },
      {
        "year": 7,
        "age": 49,
        "openingBalance": 360677.23,
        "annualContribution": 30000,
        "investmentGrowth": 31268.34,
        "closingBalance": 421945.57,
        "passiveIncome": 16877.82
      },
      {
        "year": 8,
        "age": 50,
        "openingBalance": 421945.57,
        "annualContribution": 30000,
        "investmentGrowth": 36353.61,
        "closingBalance": 488299.18,
        "passiveIncome": 19531.97
      },
      {
        "year": 9,
        "age": 51,
        "openingBalance": 488299.18,
        "annualContribution": 30000,
        "investmentGrowth": 41860.9,
        "closingBalance": 560160.08,
        "passiveIncome": 22406.4
      },
      {
        "year": 10,
        "age": 52,
        "openingBalance": 560160.08,
        "annualContribution": 30000,
        "investmentGrowth": 47825.31,
        "closingBalance": 637985.39,
        "passiveIncome": 25519.42
      },
      {
        "year": 11,
        "age": 53,
        "openingBalance": 637985.39,
        "annualContribution": 30000,
        "investmentGrowth": 54284.8,
        "closingBalance": 722270.19,
        "passiveIncome": 28890.81
      },
      {
        "year": 12,
        "age": 54,
        "openingBalance": 722270.19,
        "annualContribution": 30000,
        "investmentGrowth": 61280.38,
        "closingBalance": 813550.57,
        "passiveIncome": 32542.02
      },
      {
        "year": 13,
        "age": 55,
        "openingBalance": 813550.57,
        "annualContribution": 30000,
        "investmentGrowth": 68856.61,
        "closingBalance": 912407.18,
        "passiveIncome": 36496.29
      },
      {
        "year": 14,
        "age": 56,
        "openingBalance": 912407.18,
        "annualContribution": 30000,
        "investmentGrowth": 77061.65,
        "closingBalance": 1019468.83,
        "passiveIncome": 40778.75
      },
      {
        "year": 15,
        "age": 57,
        "openingBalance": 1019468.83,
        "annualContribution": 30000,
        "investmentGrowth": 85947.71,
        "closingBalance": 1135416.54,
        "passiveIncome": 45416.66
      },
      {
        "year": 16,
        "age": 58,
        "openingBalance": 1135416.54,
        "annualContribution": 30000,
        "investmentGrowth": 95571.32,
        "closingBalance": 1260987.86,
        "passiveIncome": 50439.51
      },
      {
        "year": 17,
        "age": 59,
        "openingBalance": 1260987.86,
        "annualContribution": 30000,
        "investmentGrowth": 105993.67,
        "closingBalance": 1396981.53,
        "passiveIncome": 55879.26
      },
      {
        "year": 18,
        "age": 60,
        "openingBalance": 1396981.53,
        "annualContribution": 30000,
        "investmentGrowth": 117281.08,
        "closingBalance": 1544262.61,
        "passiveIncome": 61770.5
      },
      {
        "year": 19,
        "age": 61,
        "openingBalance": 1544262.61,
        "annualContribution": 30000,
        "investmentGrowth": 129505.34,
        "closingBalance": 1703767.95,
        "passiveIncome": 68150.72
      },
      {
        "year": 20,
        "age": 62,
        "openingBalance": 1703767.95,
        "annualContribution": 30000,
        "investmentGrowth": 142744.23,
        "closingBalance": 1876512.18,
        "passiveIncome": 75060.49
      },
      {
        "year": 21,
        "age": 63,
        "openingBalance": 1876512.18,
        "annualContribution": 30000,
        "investmentGrowth": 157081.92,
        "closingBalance": 2063594.1,
        "passiveIncome": 82543.76
      },
      {
        "year": 22,
        "age": 64,
        "openingBalance": 2063594.1,
        "annualContribution": 53800,
        "investmentGrowth": 173252.8,
        "closingBalance": 2290646.9,
        "passiveIncome": 91625.88
      },
      {
        "year": 23,
        "age": 65,
        "openingBalance": 2290646.9,
        "annualContribution": 70800,
        "investmentGrowth": 193266.8,
        "closingBalance": 2554713.7,
        "passiveIncome": 102188.55
      },
      {
        "year": 24,
        "age": 66,
        "openingBalance": 2554713.7,
        "annualContribution": 70800,
        "investmentGrowth": 215184.25,
        "closingBalance": 2840697.95,
        "passiveIncome": 113627.92
      },
      {
        "year": 25,
        "age": 67,
        "openingBalance": 2840697.95,
        "annualContribution": 70800,
        "investmentGrowth": 238920.79,
        "closingBalance": 3150418.74,
        "passiveIncome": 126016.75
      },
      {
        "year": 26,
        "age": 68,
        "openingBalance": 3150418.74,
        "annualContribution": 70800,
        "investmentGrowth": 264627.46,
        "closingBalance": 3485846.2,
        "passiveIncome": 139433.85
      },
      {
        "year": 27,
        "age": 69,
        "openingBalance": 3485846.2,
        "annualContribution": 70800,
        "investmentGrowth": 292467.77,
        "closingBalance": 3849113.97,
        "passiveIncome": 153964.56
      },
      {
        "year": 28,
        "age": 70,
        "openingBalance": 3849113.97,
        "annualContribution": 70800,
        "investmentGrowth": 322618.81,
        "closingBalance": 4242532.78,
        "passiveIncome": 169701.31
      },
      {
        "year": 29,
        "age": 71,
        "openingBalance": 4242532.78,
        "annualContribution": 70800,
        "investmentGrowth": 355272.41,
        "closingBalance": 4668605.19,
        "passiveIncome": 186744.21
      },
      {
        "year": 30,
        "age": 72,
        "openingBalance": 4668605.19,
        "annualContribution": 70800,
        "investmentGrowth": 390636.18,
        "closingBalance": 5130041.37,
        "passiveIncome": 205201.65
      }
    ],
    "superProjection": [
      {
        "year": 1,
        "age": 43,
        "openingBalance": 240000,
        "annualContribution": 21999.96,
        "employerContribution": 21999.96,
        "extraContribution": 0,
        "investmentGrowth": 20896.91,
        "closingBalance": 282896.87,
        "passiveIncome": 11315.87
      },
      {
        "year": 2,
        "age": 44,
        "openingBalance": 282896.87,
        "annualContribution": 21999.96,
        "employerContribution": 21999.96,
        "extraContribution": 0,
        "investmentGrowth": 24457.33,
        "closingBalance": 329354.16,
        "passiveIncome": 13174.17
      },
      {
        "year": 3,
        "age": 45,
        "openingBalance": 329354.16,
        "annualContribution": 21999.96,
        "employerContribution": 21999.96,
        "extraContribution": 0,
        "investmentGrowth": 28313.26,
        "closingBalance": 379667.38,
        "passiveIncome": 15186.7
      },
      {
        "year": 4,
        "age": 46,
        "openingBalance": 379667.38,
        "annualContribution": 21999.96,
        "employerContribution": 21999.96,
        "extraContribution": 0,
        "investmentGrowth": 32489.25,
        "closingBalance": 434156.59,
        "passiveIncome": 17366.26
      },
      {
        "year": 5,
        "age": 47,
        "openingBalance": 434156.59,
        "annualContribution": 21999.96,
        "employerContribution": 21999.96,
        "extraContribution": 0,
        "investmentGrowth": 37011.82,
        "closingBalance": 493168.37,
        "passiveIncome": 19726.73
      },
      {
        "year": 6,
        "age": 48,
        "openingBalance": 493168.37,
        "annualContribution": 21999.96,
        "employerContribution": 21999.96,
        "extraContribution": 0,
        "investmentGrowth": 41909.75,
        "closingBalance": 557078.08,
        "passiveIncome": 22283.12
      },
      {
        "year": 7,
        "age": 49,
        "openingBalance": 557078.08,
        "annualContribution": 21999.96,
        "employerContribution": 21999.96,
        "extraContribution": 0,
        "investmentGrowth": 47214.25,
        "closingBalance": 626292.29,
        "passiveIncome": 25051.69
      },
      {
        "year": 8,
        "age": 50,
        "openingBalance": 626292.29,
        "annualContribution": 21999.96,
        "employerContribution": 21999.96,
        "extraContribution": 0,
        "investmentGrowth": 52958.98,
        "closingBalance": 701251.23,
        "passiveIncome": 28050.05
      },
      {
        "year": 9,
        "age": 51,
        "openingBalance": 701251.23,
        "annualContribution": 21999.96,
        "employerContribution": 21999.96,
        "extraContribution": 0,
        "investmentGrowth": 59180.54,
        "closingBalance": 782431.73,
        "passiveIncome": 31297.27
      },
      {
        "year": 10,
        "age": 52,
        "openingBalance": 782431.73,
        "annualContribution": 21999.96,
        "employerContribution": 21999.96,
        "extraContribution": 0,
        "investmentGrowth": 65918.48,
        "closingBalance": 870350.17,
        "passiveIncome": 34814.01
      },
      {
        "year": 11,
        "age": 53,
        "openingBalance": 870350.17,
        "annualContribution": 21999.96,
        "employerContribution": 21999.96,
        "extraContribution": 0,
        "investmentGrowth": 73215.69,
        "closingBalance": 965565.82,
        "passiveIncome": 38622.63
      },
      {
        "year": 12,
        "age": 54,
        "openingBalance": 965565.82,
        "annualContribution": 21999.96,
        "employerContribution": 21999.96,
        "extraContribution": 0,
        "investmentGrowth": 81118.54,
        "closingBalance": 1068684.32,
        "passiveIncome": 42747.37
      },
      {
        "year": 13,
        "age": 55,
        "openingBalance": 1068684.32,
        "annualContribution": 21999.96,
        "employerContribution": 21999.96,
        "extraContribution": 0,
        "investmentGrowth": 89677.29,
        "closingBalance": 1180361.57,
        "passiveIncome": 47214.46
      },
      {
        "year": 14,
        "age": 56,
        "openingBalance": 1180361.57,
        "annualContribution": 21999.96,
        "employerContribution": 21999.96,
        "extraContribution": 0,
        "investmentGrowth": 98946.45,
        "closingBalance": 1301307.98,
        "passiveIncome": 52052.32
      },
      {
        "year": 15,
        "age": 57,
        "openingBalance": 1301307.98,
        "annualContribution": 21999.96,
        "employerContribution": 21999.96,
        "extraContribution": 0,
        "investmentGrowth": 108984.95,
        "closingBalance": 1432292.89,
        "passiveIncome": 57291.72
      },
      {
        "year": 16,
        "age": 58,
        "openingBalance": 1432292.89,
        "annualContribution": 21999.96,
        "employerContribution": 21999.96,
        "extraContribution": 0,
        "investmentGrowth": 119856.63,
        "closingBalance": 1574149.48,
        "passiveIncome": 62965.98
      },
      {
        "year": 17,
        "age": 59,
        "openingBalance": 1574149.48,
        "annualContribution": 21999.96,
        "employerContribution": 21999.96,
        "extraContribution": 0,
        "investmentGrowth": 131630.65,
        "closingBalance": 1727780.09,
        "passiveIncome": 69111.2
      },
      {
        "year": 18,
        "age": 60,
        "openingBalance": 1727780.09,
        "annualContribution": 21999.96,
        "employerContribution": 21999.96,
        "extraContribution": 0,
        "investmentGrowth": 144381.93,
        "closingBalance": 1894161.98,
        "passiveIncome": 75766.48
      },
      {
        "year": 19,
        "age": 61,
        "openingBalance": 1894161.98,
        "annualContribution": 21999.96,
        "employerContribution": 21999.96,
        "extraContribution": 0,
        "investmentGrowth": 158191.55,
        "closingBalance": 2074353.49,
        "passiveIncome": 82974.14
      },
      {
        "year": 20,
        "age": 62,
        "openingBalance": 2074353.49,
        "annualContribution": 21999.96,
        "employerContribution": 21999.96,
        "extraContribution": 0,
        "investmentGrowth": 173147.34,
        "closingBalance": 2269500.79,
        "passiveIncome": 90780.03
      },
      {
        "year": 21,
        "age": 63,
        "openingBalance": 2269500.79,
        "annualContribution": 21999.96,
        "employerContribution": 21999.96,
        "extraContribution": 0,
        "investmentGrowth": 189344.48,
        "closingBalance": 2480845.23,
        "passiveIncome": 99233.81
      },
      {
        "year": 22,
        "age": 64,
        "openingBalance": 2480845.23,
        "annualContribution": 21999.96,
        "employerContribution": 21999.96,
        "extraContribution": 0,
        "investmentGrowth": 206885.96,
        "closingBalance": 2709731.15,
        "passiveIncome": 108389.25
      },
      {
        "year": 23,
        "age": 65,
        "openingBalance": 2709731.15,
        "annualContribution": 21999.96,
        "employerContribution": 21999.96,
        "extraContribution": 0,
        "investmentGrowth": 225883.39,
        "closingBalance": 2957614.5,
        "passiveIncome": 118304.58
      },
      {
        "year": 24,
        "age": 66,
        "openingBalance": 2957614.5,
        "annualContribution": 21999.96,
        "employerContribution": 21999.96,
        "extraContribution": 0,
        "investmentGrowth": 246457.59,
        "closingBalance": 3226072.05,
        "passiveIncome": 129042.88
      },
      {
        "year": 25,
        "age": 67,
        "openingBalance": 3226072.05,
        "annualContribution": 21999.96,
        "employerContribution": 21999.96,
        "extraContribution": 0,
        "investmentGrowth": 268739.4,
        "closingBalance": 3516811.41,
        "passiveIncome": 140672.46
      },
      {
        "year": 26,
        "age": 68,
        "openingBalance": 3516811.41,
        "annualContribution": 21999.96,
        "employerContribution": 21999.96,
        "extraContribution": 0,
        "investmentGrowth": 292870.65,
        "closingBalance": 3831682.02,
        "passiveIncome": 153267.28
      },
      {
        "year": 27,
        "age": 69,
        "openingBalance": 3831682.02,
        "annualContribution": 21999.96,
        "employerContribution": 21999.96,
        "extraContribution": 0,
        "investmentGrowth": 319004.76,
        "closingBalance": 4172686.74,
        "passiveIncome": 166907.47
      },
      {
        "year": 28,
        "age": 70,
        "openingBalance": 4172686.74,
        "annualContribution": 21999.96,
        "employerContribution": 21999.96,
        "extraContribution": 0,
        "investmentGrowth": 347307.97,
        "closingBalance": 4541994.67,
        "passiveIncome": 181679.79
      },
      {
        "year": 29,
        "age": 71,
        "openingBalance": 4541994.67,
        "annualContribution": 21999.96,
        "employerContribution": 21999.96,
        "extraContribution": 0,
        "investmentGrowth": 377960.35,
        "closingBalance": 4941954.98,
        "passiveIncome": 197678.2
      },
      {
        "year": 30,
        "age": 72,
        "openingBalance": 4941954.98,
        "annualContribution": 21999.96,
        "employerContribution": 21999.96,
        "extraContribution": 0,
        "investmentGrowth": 411156.88,
        "closingBalance": 5375111.82,
        "passiveIncome": 215004.47
      }
    ],
    "milestones": [
      {
        "name": "Work Optional",
        "targetAge": 50,
        "projectedFiAssets": 488299.18,
        "requiredCapital": 1125000,
        "passiveIncomeEstimate": 19531.97,
        "status": "red"
      },
      {
        "name": "Semi-Retirement",
        "targetAge": 55,
        "projectedFiAssets": 912407.18,
        "requiredCapital": 1687500,
        "passiveIncomeEstimate": 36496.29,
        "status": "red"
      },
      {
        "name": "Full Retirement",
        "targetAge": 60,
        "projectedFiAssets": 3438424.59,
        "requiredCapital": 2250000,
        "passiveIncomeEstimate": 137536.98,
        "status": "green"
      }
    ],
    "retirementSustainability": [
      {
        "model": "Capital Preserved",
        "startingAge": 60,
        "annualIncomeDrawn": 137536.98,
        "moneyLasts": true,
        "balances": {
          "60": 3438424.59,
          "70": 5049793.45,
          "80": 7863835.13,
          "90": 13088162.01
        }
      },
      {
        "model": "Capital Slowly Declines",
        "startingAge": 60,
        "annualIncomeDrawn": 90000,
        "moneyLasts": true,
        "balances": {
          "60": 3438424.59,
          "70": 5870150.02,
          "80": 10685049.36,
          "90": 20523201.76
        }
      },
      {
        "model": "Maximum Lifestyle",
        "startingAge": 60,
        "annualIncomeDrawn": 220941.38,
        "moneyLasts": true,
        "balances": {
          "60": 3438424.59,
          "70": 3610464.43,
          "80": 2913968.97,
          "90": 43264.1
        }
      }
    ],
    "decisionOptions": [
      {
        "option": "extra super",
        "score": 0.1358,
        "explanation": "Potential tax benefit and compounding, but access is restricted until preservation age."
      },
      {
        "option": "offset account",
        "score": 0.066,
        "explanation": "Guaranteed interest saving, keeps cash accessible, and the benefit is tax-free."
      },
      {
        "option": "ETF/share investing",
        "score": 0.0582,
        "explanation": "Higher expected long-term return, but market risk means the result is not guaranteed."
      },
      {
        "option": "extra mortgage repayment",
        "score": 0.0535,
        "explanation": "Guaranteed interest saving, but less flexible than keeping money in the offset account."
      }
    ],
    "netWorthProjection": [
      {
        "year": 1,
        "age": 43,
        "openingBalance": 790000,
        "annualContribution": 65102.31,
        "investmentGrowth": 0,
        "closingBalance": 910971.44,
        "passiveIncome": 36438.86
      },
      {
        "year": 2,
        "age": 44,
        "openingBalance": 0,
        "annualContribution": 65102.31,
        "investmentGrowth": 0,
        "closingBalance": 1040286.96,
        "passiveIncome": 41611.48
      },
      {
        "year": 3,
        "age": 45,
        "openingBalance": 0,
        "annualContribution": 65102.31,
        "investmentGrowth": 0,
        "closingBalance": 1178579.51,
        "passiveIncome": 47143.18
      },
      {
        "year": 4,
        "age": 46,
        "openingBalance": 0,
        "annualContribution": 65102.31,
        "investmentGrowth": 0,
        "closingBalance": 1326532.26,
        "passiveIncome": 53061.29
      },
      {
        "year": 5,
        "age": 47,
        "openingBalance": 0,
        "annualContribution": 65102.31,
        "investmentGrowth": 0,
        "closingBalance": 1484882.66,
        "passiveIncome": 59395.31
      },
      {
        "year": 6,
        "age": 48,
        "openingBalance": 0,
        "annualContribution": 65102.31,
        "investmentGrowth": 0,
        "closingBalance": 1654426.79,
        "passiveIncome": 66177.07
      },
      {
        "year": 7,
        "age": 49,
        "openingBalance": 0,
        "annualContribution": 65102.31,
        "investmentGrowth": 0,
        "closingBalance": 1836024.17,
        "passiveIncome": 73440.97
      },
      {
        "year": 8,
        "age": 50,
        "openingBalance": 0,
        "annualContribution": 65102.31,
        "investmentGrowth": 0,
        "closingBalance": 2030602.87,
        "passiveIncome": 81224.11
      },
      {
        "year": 9,
        "age": 51,
        "openingBalance": 0,
        "annualContribution": 65102.31,
        "investmentGrowth": 0,
        "closingBalance": 2239165.07,
        "passiveIncome": 89566.6
      },
      {
        "year": 10,
        "age": 52,
        "openingBalance": 0,
        "annualContribution": 65102.31,
        "investmentGrowth": 0,
        "closingBalance": 2462793.06,
        "passiveIncome": 98511.72
      },
      {
        "year": 11,
        "age": 53,
        "openingBalance": 0,
        "annualContribution": 65102.31,
        "investmentGrowth": 0,
        "closingBalance": 2702655.9,
        "passiveIncome": 108106.24
      },
      {
        "year": 12,
        "age": 54,
        "openingBalance": 0,
        "annualContribution": 65102.31,
        "investmentGrowth": 0,
        "closingBalance": 2960016.19,
        "passiveIncome": 118400.65
      },
      {
        "year": 13,
        "age": 55,
        "openingBalance": 0,
        "annualContribution": 65102.31,
        "investmentGrowth": 0,
        "closingBalance": 3236237.88,
        "passiveIncome": 129449.52
      },
      {
        "year": 14,
        "age": 56,
        "openingBalance": 0,
        "annualContribution": 65102.31,
        "investmentGrowth": 0,
        "closingBalance": 3532794.55,
        "passiveIncome": 141311.78
      },
      {
        "year": 15,
        "age": 57,
        "openingBalance": 0,
        "annualContribution": 65102.31,
        "investmentGrowth": 0,
        "closingBalance": 3851278.18,
        "passiveIncome": 154051.13
      },
      {
        "year": 16,
        "age": 58,
        "openingBalance": 0,
        "annualContribution": 65102.31,
        "investmentGrowth": 0,
        "closingBalance": 4193408.98,
        "passiveIncome": 167736.36
      },
      {
        "year": 17,
        "age": 59,
        "openingBalance": 0,
        "annualContribution": 65102.31,
        "investmentGrowth": 0,
        "closingBalance": 4561045.6,
        "passiveIncome": 182441.82
      },
      {
        "year": 18,
        "age": 60,
        "openingBalance": 0,
        "annualContribution": 65102.31,
        "investmentGrowth": 0,
        "closingBalance": 4956196.71,
        "passiveIncome": 198247.87
      },
      {
        "year": 19,
        "age": 61,
        "openingBalance": 0,
        "annualContribution": 65102.31,
        "investmentGrowth": 0,
        "closingBalance": 5381032.98,
        "passiveIncome": 215241.32
      },
      {
        "year": 20,
        "age": 62,
        "openingBalance": 0,
        "annualContribution": 65102.31,
        "investmentGrowth": 0,
        "closingBalance": 5837033,
        "passiveIncome": 233481.32
      },
      {
        "year": 21,
        "age": 63,
        "openingBalance": 0,
        "annualContribution": 65102.31,
        "investmentGrowth": 0,
        "closingBalance": 6325024.36,
        "passiveIncome": 253000.97
      },
      {
        "year": 22,
        "age": 64,
        "openingBalance": 0,
        "annualContribution": 65102.31,
        "investmentGrowth": 0,
        "closingBalance": 6844871.12,
        "passiveIncome": 273794.84
      },
      {
        "year": 23,
        "age": 65,
        "openingBalance": 0,
        "annualContribution": 65102.31,
        "investmentGrowth": 0,
        "closingBalance": 7408556.06,
        "passiveIncome": 296342.24
      },
      {
        "year": 24,
        "age": 66,
        "openingBalance": 0,
        "annualContribution": 65102.31,
        "investmentGrowth": 0,
        "closingBalance": 8016284.7,
        "passiveIncome": 320651.39
      },
      {
        "year": 25,
        "age": 67,
        "openingBalance": 0,
        "annualContribution": 65102.31,
        "investmentGrowth": 0,
        "closingBalance": 8671630.29,
        "passiveIncome": 346865.21
      },
      {
        "year": 26,
        "age": 68,
        "openingBalance": 0,
        "annualContribution": 65102.31,
        "investmentGrowth": 0,
        "closingBalance": 9378460.36,
        "passiveIncome": 375138.41
      },
      {
        "year": 27,
        "age": 69,
        "openingBalance": 0,
        "annualContribution": 65102.31,
        "investmentGrowth": 0,
        "closingBalance": 10140960.82,
        "passiveIncome": 405638.43
      },
      {
        "year": 28,
        "age": 70,
        "openingBalance": 0,
        "annualContribution": 65102.31,
        "investmentGrowth": 0,
        "closingBalance": 10963662.36,
        "passiveIncome": 438546.49
      },
      {
        "year": 29,
        "age": 71,
        "openingBalance": 0,
        "annualContribution": 65102.31,
        "investmentGrowth": 0,
        "closingBalance": 11851469.13,
        "passiveIncome": 474058.77
      },
      {
        "year": 30,
        "age": 72,
        "openingBalance": 0,
        "annualContribution": 65102.31,
        "investmentGrowth": 0,
        "closingBalance": 12809689.41,
        "passiveIncome": 512387.58
      }
    ],
    "taxBenefitFromExtraSuper": 0,
    "totalRetirementAssets": 3438424.59
  },
  "disclaimer": "This tool is for education and modelling only and is not financial advice."
};
