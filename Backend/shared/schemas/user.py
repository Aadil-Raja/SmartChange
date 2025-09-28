from pydantic import BaseModel, EmailStr

class UserCreate(BaseModel):
    email: EmailStr
    name: str
    password: str   # plain password for signup

class UserOut(BaseModel):
    id: int
    email: EmailStr
    name: str

    class Config:
        orm_mode = True  # allows SQLAlchemy -> Pydantic conversion
