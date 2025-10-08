from pydantic import BaseModel, EmailStr
from datetime import datetime
from enum import Enum



class JoinCodeIn(BaseModel):
    code: str