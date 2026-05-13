from functools import wraps
from sqlmodel import Session


def transactional(func):
    @wraps(func)
    def wrapper(*args, **kwargs):
        self = args[0]
        engine = self.engine
        args_session = any((isinstance(val, Session) for val in args))
        kwargs_session = kwargs.get("session", None) is not None
        if not args_session and not kwargs_session:
            with Session(engine) as session:
                kwargs["session"] = session
                return func(*args, **kwargs)
        else:
            return func(*args, **kwargs)
    return wrapper
