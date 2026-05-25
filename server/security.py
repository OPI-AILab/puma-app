import datetime as dt
import logging
from typing import Optional
from fastapi import status, HTTPException, Request
from jose import jwt, JWTError
from passlib.context import CryptContext


class Security:

    PWD_CONTEXT = CryptContext(schemes=["bcrypt"], deprecated="auto")
    ACCESS_TOKEN_EXPIRE_HOURS = 240
    ALGORITHM = "HS256"
    SECRET_KEY = None

    @staticmethod
    def create_token(data: dict, expires_delta: Optional[dt.timedelta] = None):
        to_encode = data.copy()
        expire = dt.datetime.utcnow() + (expires_delta or dt.timedelta(hours=Security.ACCESS_TOKEN_EXPIRE_HOURS))
        to_encode.update({"exp": expire})
        return jwt.encode(to_encode, Security.SECRET_KEY, algorithm=Security.ALGORITHM)

    @staticmethod
    def verify_token(token: str):
        try:
            payload = jwt.decode(token, Security.SECRET_KEY, algorithms=[Security.ALGORITHM])
            username: str = payload.get("sub")
            if username is None:
                return None
            return username
        except JWTError:
            logging.warning("JWT decoding error")
            return None

    @staticmethod
    def hash_password(password: str):
        return Security.PWD_CONTEXT.hash(password)

    @staticmethod
    def verify_password(plain: str, hashed: str):
        return Security.PWD_CONTEXT.verify(plain, hashed)

    @staticmethod
    def auth(request: Request):
        token = request.cookies.get("access_token")
        if not token:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")
        username = Security.verify_token(token)
        if not username:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired token")
        return username

    @staticmethod
    def admin_auth(request: Request):
        username = Security.auth(request)
        if username != "admin":
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin access required")
        return username
