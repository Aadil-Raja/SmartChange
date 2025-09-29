from pydantic import BaseModel, EmailStr

class RequestCodeIn(BaseModel):
    email: EmailStr

class VerifyCodeIn(BaseModel):
    email: EmailStr
    code: str


class TokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"

class MeOut(BaseModel):
    email: EmailStr
    name: str | None = None

    class Config:
        from_attributes = True

class LoginPasswordIn(BaseModel):
    email: EmailStr
    password: str