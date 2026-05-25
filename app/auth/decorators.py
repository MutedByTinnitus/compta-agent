"""Décorateurs d'auth : org_required."""
import uuid as _uuid
from functools import wraps

from flask import jsonify, request
from flask_login import current_user

from ..extensions import db
from ..models.run import Run


def _is_uuid(s):
    try:
        _uuid.UUID(str(s))
        return True
    except (ValueError, TypeError):
        return False


def resolve_run_for_current_user(run_identifier):
    """Trouve un Run accessible au user courant à partir d'un id (uuid, legacy_run_id, legacy_job_id).

    Returns: Run|None
    """
    if not run_identifier or not current_user.is_authenticated:
        return None

    query = db.session.query(Run).filter(
        Run.organization_id == current_user.organization_id
    )

    if _is_uuid(run_identifier):
        run = query.filter(Run.id == run_identifier).first()
        if run:
            return run

    # Sinon, chercher par legacy_run_id ou legacy_job_id
    return query.filter(
        (Run.legacy_run_id == run_identifier) |
        (Run.legacy_job_id == run_identifier)
    ).first()


def org_run_required(f):
    """Décorateur : la route doit avoir un kwarg run_id. Injecte un kwarg `run` (objet Run)
    en s'assurant qu'il appartient à l'organization du user courant."""
    @wraps(f)
    def decorated(*args, **kwargs):
        run_id = kwargs.get('run_id')
        run = resolve_run_for_current_user(run_id)
        if run is None:
            return jsonify({'error': 'Run not found'}), 404
        kwargs['run'] = run
        return f(*args, **kwargs)
    return decorated
