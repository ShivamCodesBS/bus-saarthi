# Start-All.ps1

Write-Host "Starting Web Servers (NestJS & Vite)..." -ForegroundColor Green
Start-Process cmd -ArgumentList "/k `"cd c:\Users\Acer\Desktop\alok\bus-sarthi\INVERTIS_BUS_SAARTHI\nestjs-backend && title NestJS Backend && npm run start:dev`""

Start-Process cmd -ArgumentList "/k `"cd c:\Users\Acer\Desktop\alok\bus-sarthi\INVERTIS_BUS_SAARTHI\frontend && title NextJS/Vite Frontend && npm run dev`""

Write-Host "Starting Media Infrastructure (Native & Edge Push)..." -ForegroundColor Cyan
Start-Process cmd -ArgumentList "/k `"cd c:\Users\Acer\Desktop\alok\bus-sarthi\INVERTIS_BUS_SAARTHI\media-server && title MediaMTX Native && .\mediamtx.exe`""

Start-Sleep -Seconds 5

Start-Process cmd -ArgumentList "/k `"cd c:\Users\Acer\Desktop\alok\bus-sarthi\INVERTIS_BUS_SAARTHI\edge-script && title Edge Push Script && node edge-push.js`""

Write-Host "All processes started in separate windows!" -ForegroundColor Yellow
