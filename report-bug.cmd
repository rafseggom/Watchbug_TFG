@echo off
:: Watchbug Phase 2 - Open browser to test reporting
:: This script opens the Watchbug panel in your default browser
:: Make sure Docker is running first: docker compose up -d --build

echo.
echo ==========================================
echo  Watchbug - Reporte de Errores (Phase 2)
echo ==========================================
echo.
echo  Asegurate de que Docker esté corriendo:
echo   docker compose up -d --build
echo.
echo  Esperando que los servicios estén listos...
timeout /t 5 /nobreak > nul

:: Open the panel in the default browser
start "" http://127.0.0.1:8080

echo.
echo  El panel se abrió en tu navegador.
echo  Revisa los reportes existentes o prueba el widget.
echo.
echo  Para generar una clave de proyecto (si es la primera vez):
echo   npm run key:gen
echo.
echo  Para construir los bundles SDK:
echo   npm run build
echo.
echo  Para ver la documentación completa:
echo   Ver documentation/mission-brief.md
echo.
echo ==========================================
pause