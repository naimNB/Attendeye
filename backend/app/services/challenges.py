import secrets
from datetime import timedelta
from fastapi import HTTPException
from sqlalchemy import update
from sqlalchemy.orm import Session
from ..models import Challenge, now
from ..security import token, decode_token, auth_error


def issue(db: Session, user_id: int, session_id: int, mode: str = "random") -> dict:
    prompt = "blink" if mode == "blink" else secrets.choice(["blink", "turn_left", "turn_right"])
    challenge_id = secrets.token_hex(24)
    db.add(Challenge(id=challenge_id, user_id=user_id, session_id=session_id, prompt=prompt,
                     expires_at=now() + timedelta(seconds=15)))
    db.commit()
    return {"token": token({"cid": challenge_id, "sub": str(user_id), "sid": session_id}, "challenge", 15),
            "prompt": prompt, "expires_in": 15,
            "instructions": {"blink": "Start with eyes open, blink slowly, then open your eyes.",
                             "turn_left": "Look straight, turn to your left, then look straight again.",
                             "turn_right": "Look straight, turn to your right, then look straight again."}[prompt]}


def consume(db: Session, signed: str, user_id: int, session_id: int) -> str:
    data = decode_token(signed, "challenge")
    if data.get("sub") != str(user_id) or data.get("sid") != session_id:
        raise HTTPException(403, "Challenge is bound to another user or session")
    row = db.get(Challenge, data.get("cid", ""))
    if row is None:
        raise auth_error(401, "CHALLENGE_NOT_FOUND", "Unknown challenge")
    prompt = row.prompt
    result = db.execute(update(Challenge).where(Challenge.id == row.id, Challenge.used.is_(False),
                                               Challenge.expires_at > now()).values(used=True))
    db.commit()  # Consume even if later inference fails; never allow retry/replay of this token.
    if result.rowcount != 1:
        raise HTTPException(409, "Challenge expired or already used")
    return prompt
