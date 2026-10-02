from datetime import datetime
from typing import Annotated, Generic, TypeVar

from pydantic import BaseModel, ConfigDict, PlainSerializer

from app.core.utils import iso

# Serialises naive-UTC datetimes as ISO-8601 with a trailing "Z"
UTCDateTime = Annotated[datetime, PlainSerializer(iso, return_type=str, when_used="json")]

T = TypeVar("T")


class ORMModel(BaseModel):
    model_config = ConfigDict(from_attributes=True)


class Page(BaseModel, Generic[T]):
    items: list[T]
    total: int
    page: int
    size: int
    pages: int


class Message(BaseModel):
    message: str
