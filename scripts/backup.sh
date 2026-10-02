#!/bin/sh

echo "Iniciando servicio de backups hacia Google Drive (Sin encriptación)..."

# Directorio de backups locales (montado en Docker)
BACKUP_DIR="/backups"

while true; do
  TIMESTAMP=$(date +"%Y-%m-%d_%H-%M-%S")
  BACKUP_FILE="${BACKUP_DIR}/gs_db_${TIMESTAMP}.sql.gz"
  
  echo "[${TIMESTAMP}] Creando backup local..."
  
  # Exportar DB y comprimir al vuelo
  PGPASSWORD="${POSTGRES_PASSWORD}" pg_dump -h postgres -U "${POSTGRES_USER}" -d gs_control_center | gzip > "${BACKUP_FILE}"
  
  if [ $? -eq 0 ]; then
    echo "✅ Backup local completado: ${BACKUP_FILE}"
    
    # Verificar si rclone tiene configurado el remote 'gdrive'
    if rclone config show gdrive > /dev/null 2>&1; then
      echo "☁️ Subiendo a Google Drive..."
      # Usamos rclone copy para enviar el archivo al folder GrowthShell_Backups
      rclone copy "${BACKUP_FILE}" gdrive:GrowthShell_Backups/
      
      if [ $? -eq 0 ]; then
        echo "✅ Subida a Google Drive exitosa."
        
        # Limpieza: Borrar backups locales mayores a 7 días para no llenar el disco del VPS
        echo "🧹 Limpiando backups locales antiguos..."
        find "${BACKUP_DIR}" -type f -name "gs_db_*.sql.gz" -mtime +7 -exec rm {} \;
        
        # Opcional: Rclone también puede limpiar el Drive, pero por seguridad
        # es mejor dejar que Google Drive maneje el histórico o borrarlo manualmente.
      else
        echo "❌ ERROR: Falló la subida a Google Drive."
      fi
    else
      echo "⚠️ ADVERTENCIA: El remoto 'gdrive' de Rclone no está configurado. El backup se guardará solo en el disco del VPS."
      echo "   Configúralo ejecutando 'rclone config' e inyectando la carpeta de configuración al contenedor."
    fi
  else
    echo "❌ ERROR: Falló el comando pg_dump."
  fi
  
  echo "⏳ Siguiente backup programado en 24 horas..."
  # Esperar 24 horas (86400 segundos)
  sleep 86400
done
