from pydantic import BaseModel, EmailStr, Field, field_validator

from app.schemas.common import ORMModel, UTCDateTime

USERNAME_PATTERN = r"^[A-Za-z0-9_.-]+$"


class RoleOut(ORMModel):
    id: int
    name: str
    description: str | None = None


class RoleWithCount(RoleOut):
    user_count: int = 0


class UserBase(BaseModel):
    full_name: str | None = Field(None, max_length=100)


class UserCreate(UserBase):
    username: str = Field(..., min_length=3, max_length=50, pattern=USERNAME_PATTERN)
    email: EmailStr
    password: str = Field(..., min_length=8, max_length=64)
    role_id: int

    @field_validator("email")
    @classmethod
    def lower_email(cls, v: str) -> str:
        return v.lower()

    @field_validator("password")
    @classmethod
    def strong_password(cls, v: str) -> str:
        if not any(c.isupper() for c in v) or not any(c.islower() for c in v) or not any(c.isdigit() for c in v):
            raise ValueError("Password must contain upper-case, lower-case letters and a digit")
        return v


class UserUpdate(UserBase):
    email: EmailStr | None = None
    role_id: int | None = None
    is_active: bool | None = None
    password: str | None = Field(None, min_length=8, max_length=64)

    @field_validator("email")
    @classmethod
    def lower_email(cls, v: str | None) -> str | None:
        return v.lower() if v else v


class UserOut(ORMModel):
    id: int
    username: str
    email: str
    full_name: str | None = None
    role: RoleOut
    is_active: bool
    last_login_at: UTCDateTime | None = None
    created_at: UTCDateTime
    updated_at: UTCDateTime
