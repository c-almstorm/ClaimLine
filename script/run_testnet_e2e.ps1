$ErrorActionPreference = "Stop"
$env:Path = "$HOME\.foundry\bin;" + $env:Path

$rpcUrl = "https://rpc.testnet.arc.io"
$explorerUrl = "https://explorer.testnet.arc.io"
$usdcAddress = "0x3600000000000000000000000000000000000000"
$claimLineAddr = "0xeFCBD627341F70AED57d0099B030B06C40516279"
$deployTxHash = "0xda5fda81e5bf51c52931e30062b4991bafadcbd451180fb78925aa734b265110"
$pwFile = "$HOME\.foundry\password.txt"

$deployerAccount = "claimline-deployer"
$lender1Account  = "claimline-lender1"
$lender2Account  = "claimline-lender2"

$deployerAddr = (cast wallet address --account $deployerAccount --password-file $pwFile).Trim()
$lender1Addr  = (cast wallet address --account $lender1Account --password-file $pwFile).Trim()
$lender2Addr  = (cast wallet address --account $lender2Account --password-file $pwFile).Trim()

Write-Host "=========================================="
Write-Host "CLAIMLINE TESTNET END-TO-END EXECUTION"
Write-Host "=========================================="
Write-Host "Contract:            $claimLineAddr"
Write-Host "Deployer / Borrower: $deployerAddr"
Write-Host "Lender 1:            $lender1Addr"
Write-Host "Lender 2:            $lender2Addr"

function Get-Balances ($addr) {
    $nativeBal = (cast balance $addr --rpc-url $rpcUrl).Trim()
    $usdcBal = (cast call $usdcAddress "balanceOf(address)(uint256)" $addr --rpc-url $rpcUrl).Trim()
    return [PSCustomObject]@{
        Address = $addr
        NativeWei = $nativeBal
        UsdcUnits = $usdcBal
    }
}

$deployerInit = Get-Balances $deployerAddr
$lender1Init  = Get-Balances $lender1Addr
$lender2Init  = Get-Balances $lender2Addr

Write-Host "`nInitial USDC Balances:"
Write-Host "Deployer / Borrower: $($deployerInit.UsdcUnits) (units)"
Write-Host "Lender 1:            $($lender1Init.UsdcUnits) (units)"
Write-Host "Lender 2:            $($lender2Init.UsdcUnits) (units)"

# Helper function to send transaction and extract txHash
function Send-Tx ($cmd) {
    Write-Host "Running: $cmd"
    $raw = Invoke-Expression $cmd
    $txHash = ($raw | Select-String "transactionHash\s+(0x[a-fA-F0-9]+)").Matches.Groups[1].Value
    if (!$txHash) {
        $json = $raw | ConvertFrom-Json -ErrorAction SilentlyContinue
        if ($json.transactionHash) { $txHash = $json.transactionHash }
    }
    if (!$txHash) {
        Write-Host "Raw output: $raw"
        throw "Failed to extract transaction hash"
    }
    Write-Host "-> Tx Hash: $txHash"
    return $txHash
}

# 1. Register Asset
Write-Host "`n[1/6] Registering collateral asset..."
$faceValue = 10000000     # 10 USDC
$seniorCap = 6000000      # 6 USDC
$juniorCap = 3000000      # 3 USDC
$seniorRepay = 6600000    # 6.6 USDC
$juniorRepay = 3600000    # 3.6 USDC
$deadline = [int64]((Get-Date).ToUniversalTime() - (Get-Date "1970-01-01")).TotalSeconds + 86400

$regCmd = "cast send $claimLineAddr `"registerAsset(string,string,address,address,uint256,uint256,uint256,uint256,uint256,uint256)`" `"Invoice`" `"INV-ARC-TESTNET-001`" $deployerAddr $deployerAddr $faceValue $seniorCap $juniorCap $seniorRepay $juniorRepay $deadline --rpc-url $rpcUrl --account $deployerAccount --password-file $pwFile"
$regTxHash = Send-Tx $regCmd

$assetId = (cast keccak (cast abi-encode "f(string,string,address,address,uint256)" "Invoice" "INV-ARC-TESTNET-001" $deployerAddr $deployerAddr $faceValue)).Trim()
Write-Host "Asset ID: $assetId"

# 2. Approvals
Write-Host "`n[2/6] Setting token approvals..."
$maxUint = "115792089237316195423570985008687907853269984665640564039457584007913129639935"

$appL1Cmd = "cast send $usdcAddress `"approve(address,uint256)`" $claimLineAddr $maxUint --rpc-url $rpcUrl --account $lender1Account --password-file $pwFile"
$appL1Tx = Send-Tx $appL1Cmd

$appL2Cmd = "cast send $usdcAddress `"approve(address,uint256)`" $claimLineAddr $maxUint --rpc-url $rpcUrl --account $lender2Account --password-file $pwFile"
$appL2Tx = Send-Tx $appL2Cmd

$appBorrowerCmd = "cast send $usdcAddress `"approve(address,uint256)`" $claimLineAddr $maxUint --rpc-url $rpcUrl --account $deployerAccount --password-file $pwFile"
$appBorrowerTx = Send-Tx $appBorrowerCmd

# 3. Placing Locks (Two Senior, One Junior)
Write-Host "`n[3/6] Placing 3 locks..."
# Lock 1: Lender 1 locks 4 USDC Senior
$lock1Cmd = "cast send $claimLineAddr `"lock(bytes32,uint256,uint8)`" $assetId 4000000 0 --rpc-url $rpcUrl --account $lender1Account --password-file $pwFile"
$lock1Tx = Send-Tx $lock1Cmd

# Lock 2: Lender 2 locks 4 USDC Senior (Senior cap is 6 USDC -> 2 accepted, 2 refunded)
$lock2Cmd = "cast send $claimLineAddr `"lock(bytes32,uint256,uint8)`" $assetId 4000000 0 --rpc-url $rpcUrl --account $lender2Account --password-file $pwFile"
$lock2Tx = Send-Tx $lock2Cmd

# Lock 3: Lender 1 locks 3 USDC Junior (Junior cap is 3 USDC -> 3 accepted)
$lock3Cmd = "cast send $claimLineAddr `"lock(bytes32,uint256,uint8)`" $assetId 3000000 1 --rpc-url $rpcUrl --account $lender1Account --password-file $pwFile"
$lock3Tx = Send-Tx $lock3Cmd

# 4. Close Race
Write-Host "`n[4/6] Closing race (allocating positions and pull-based proceeds)..."
$closeCmd = "cast send $claimLineAddr `"close(bytes32)`" $assetId --rpc-url $rpcUrl --account $deployerAccount --password-file $pwFile"
$closeTx = Send-Tx $closeCmd

# 5. Repay Partially
Write-Host "`n[5/6] Repaying 7.0 USDC (6.6 Senior + 0.4 Junior)..."
$repayCmd = "cast send $claimLineAddr `"repay(bytes32,uint256)`" $assetId 7000000 --rpc-url $rpcUrl --account $deployerAccount --password-file $pwFile"
$repayTx = Send-Tx $repayCmd

# 6. Everyone Claims
Write-Host "`n[6/6] Claiming proceeds, refunds, and repayments..."
# Borrower claims proceeds (9.0 USDC)
$claimBorrowerCmd = "cast send $claimLineAddr `"claim(bytes32)`" $assetId --rpc-url $rpcUrl --account $deployerAccount --password-file $pwFile"
$claimBorrowerTx = Send-Tx $claimBorrowerCmd

# Lender 1 claims repayment (4.4 Senior + 0.4 Junior = 4.8 USDC)
$claimL1Cmd = "cast send $claimLineAddr `"claim(bytes32)`" $assetId --rpc-url $rpcUrl --account $lender1Account --password-file $pwFile"
$claimL1Tx = Send-Tx $claimL1Cmd

# Lender 2 claims refund + repayment (2.0 refund + 2.2 Senior = 4.2 USDC)
$claimL2Cmd = "cast send $claimLineAddr `"claim(bytes32)`" $assetId --rpc-url $rpcUrl --account $lender2Account --password-file $pwFile"
$claimL2Tx = Send-Tx $claimL2Cmd

# Final Balances
$deployerFinal = Get-Balances $deployerAddr
$lender1Final  = Get-Balances $lender1Addr
$lender2Final  = Get-Balances $lender2Addr

Write-Host "`nFinal USDC Balances:"
Write-Host "Deployer / Borrower: $($deployerFinal.UsdcUnits) (units)"
Write-Host "Lender 1:            $($lender1Final.UsdcUnits) (units)"
Write-Host "Lender 2:            $($lender2Final.UsdcUnits) (units)"

$evidenceDir = "evidence"
if (!(Test-Path $evidenceDir)) {
    New-Item -ItemType Directory -Path $evidenceDir -Force | Out-Null
}

$evidence = [ordered]@{
    network = "Arc Testnet"
    chainId = 5042002
    contractAddress = $claimLineAddr
    assetId = $assetId
    explorerContractUrl = "$explorerUrl/address/$claimLineAddr"
    transactions = [ordered]@{
        deployContract = [ordered]@{
            txHash = $deployTxHash
            explorerUrl = "$explorerUrl/tx/$deployTxHash"
        }
        registerAsset = [ordered]@{
            txHash = $regTxHash
            explorerUrl = "$explorerUrl/tx/$regTxHash"
            details = "FaceValue: 10 USDC, SeniorCap: 6 USDC, JuniorCap: 3 USDC, SeniorRepay: 6.6 USDC, JuniorRepay: 3.6 USDC"
        }
        approveLender1 = [ordered]@{
            txHash = $appL1Tx
            explorerUrl = "$explorerUrl/tx/$appL1Tx"
        }
        approveLender2 = [ordered]@{
            txHash = $appL2Tx
            explorerUrl = "$explorerUrl/tx/$appL2Tx"
        }
        approveBorrower = [ordered]@{
            txHash = $appBorrowerTx
            explorerUrl = "$explorerUrl/tx/$appBorrowerTx"
        }
        lock1_Lender1_Senior = [ordered]@{
            txHash = $lock1Tx
            explorerUrl = "$explorerUrl/tx/$lock1Tx"
            amountUSDC = "4.0"
            tranche = "Senior (Accepted 4.0)"
        }
        lock2_Lender2_Senior = [ordered]@{
            txHash = $lock2Tx
            explorerUrl = "$explorerUrl/tx/$lock2Tx"
            amountUSDC = "4.0"
            tranche = "Senior (Accepted 2.0, Refund 2.0)"
        }
        lock3_Lender1_Junior = [ordered]@{
            txHash = $lock3Tx
            explorerUrl = "$explorerUrl/tx/$lock3Tx"
            amountUSDC = "3.0"
            tranche = "Junior (Accepted 3.0)"
        }
        closeRace = [ordered]@{
            txHash = $closeTx
            explorerUrl = "$explorerUrl/tx/$closeTx"
            details = "Senior Accepted: 6.0 USDC, Junior Accepted: 3.0 USDC, Borrower Proceeds: 9.0 USDC"
        }
        repayPartial = [ordered]@{
            txHash = $repayTx
            explorerUrl = "$explorerUrl/tx/$repayTx"
            amountUSDC = "7.0 (6.6 Senior + 0.4 Junior)"
        }
        claimBorrower = [ordered]@{
            txHash = $claimBorrowerTx
            explorerUrl = "$explorerUrl/tx/$claimBorrowerTx"
            payoutUSDC = "9.0"
        }
        claimLender1 = [ordered]@{
            txHash = $claimL1Tx
            explorerUrl = "$explorerUrl/tx/$claimL1Tx"
            payoutUSDC = "4.8 (4.4 Senior + 0.4 Junior)"
        }
        claimLender2 = [ordered]@{
            txHash = $claimL2Tx
            explorerUrl = "$explorerUrl/tx/$claimL2Tx"
            payoutUSDC = "4.2 (2.0 Refund + 2.2 Senior)"
        }
    }
    balances = [ordered]@{
        borrower = [ordered]@{
            address = $deployerAddr
            initialUSDC_units = $deployerInit.UsdcUnits
            finalUSDC_units = $deployerFinal.UsdcUnits
        }
        lender1 = [ordered]@{
            address = $lender1Addr
            initialUSDC_units = $lender1Init.UsdcUnits
            finalUSDC_units = $lender1Final.UsdcUnits
        }
        lender2 = [ordered]@{
            address = $lender2Addr
            initialUSDC_units = $lender2Init.UsdcUnits
            finalUSDC_units = $lender2Final.UsdcUnits
        }
    }
}

$evidence | ConvertTo-Json -Depth 10 | Set-Content -Path "evidence/testnet-run.json"
Write-Host "`nEvidence successfully written to evidence/testnet-run.json!"
