"""Point d'entrée de l'application ENOP.

Usage local :     python run.py
Usage Docker :    CMD ["python", "run.py"]  (avec alembic upgrade head avant)
Usage WSGI prod : gunicorn 'run:app' -w 4
"""
import logging
import os
import threading

from app import create_app
import ocr_engine

app = create_app()


def _log_startup_banner():
    log = logging.getLogger('enop')
    log.info("=" * 50)
    log.info("  ENOP.AI v6.0 — multi-tenant beta")
    log.info("=" * 50)
    log.info("Securite :")
    log.info(f"  Legacy admin : {'ACTIF' if os.environ.get('ALLOW_LEGACY_ADMIN', 'false').lower() == 'true' else 'OFF'}")
    log.info(f"  Zero Data    : fichiers supprimes apres {getattr(ocr_engine, 'FILE_RETENTION_MINUTES', 10)} min")
    log.info("Providers :")
    docai_ok = bool(getattr(ocr_engine, 'GOOGLE_DOCAI_PROJECT_ID', None)
                    and getattr(ocr_engine, 'GOOGLE_DOCAI_PROCESSOR_ID', None))
    log.info(f"  OCR Google DocAI : {'OK' if docai_ok else 'NON'}")
    log.info(f"  LLM Gemini       : {'OK' if getattr(ocr_engine, 'GEMINI_API_KEY', None) else 'NON'}")
    log.info(f"  LLM Claude       : {'OK' if getattr(ocr_engine, 'ANTHROPIC_API_KEY', None) else 'NON'}")
    log.info(f"  DB               : {app.config.get('SQLALCHEMY_DATABASE_URI', '?').split('@')[-1]}")
    log.info("Interface : http://localhost:5000")
    log.info("=" * 50)


def _start_background_threads():
    """Lance les threads de nettoyage et d'email polling."""
    schedule_cleanup = getattr(ocr_engine, 'schedule_cleanup', None)
    if schedule_cleanup:
        threading.Thread(target=schedule_cleanup, daemon=True).start()

    check_emails = getattr(ocr_engine, 'check_emails', None)
    email_address = getattr(ocr_engine, 'EMAIL_ADDRESS', '') or ''
    email_password = getattr(ocr_engine, 'EMAIL_PASSWORD', '') or ''
    if check_emails and email_address and email_password:
        threading.Thread(target=check_emails, daemon=True).start()


if __name__ == '__main__':
    _log_startup_banner()
    _start_background_threads()
    app.run(host='0.0.0.0', port=5000, debug=False)
