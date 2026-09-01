from pydantic import BaseModel, Field


class LoginRequest(BaseModel):
    email: str = Field(min_length=3, description="admin email")
    password: str = Field(min_length=1)


class MessageResponse(BaseModel):
    message: str
