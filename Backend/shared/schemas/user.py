from pydantic import BaseModel, EmailStr

class UserCreate(BaseModel):
    email: EmailStr

    password: str   # plain password for signup

class UserOut(BaseModel):
    id: int
    email: EmailStr
    name: str

    class Config:
        from_attributes = True   # ✅ replaces orm_mode