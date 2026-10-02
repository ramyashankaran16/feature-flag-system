from pydantic import BaseModel, Field


class EvaluateRequest(BaseModel):
    flag_key: str = Field(..., max_length=100)
    user_id: str | None = Field(None, max_length=255, description="End-user identifier from your application")


class BulkEvaluateRequest(BaseModel):
    user_id: str | None = Field(None, max_length=255)


class TestEvaluateRequest(EvaluateRequest):
    environment_key: str


class EvaluateResponse(BaseModel):
    flag_key: str
    environment: str
    user_id: str | None = None
    enabled: bool
    reason: str


class TestEvaluateResponse(EvaluateResponse):
    bucket: int | None = Field(None, description="User's rollout bucket (0-99)")


class BulkEvaluateResponse(BaseModel):
    environment: str
    user_id: str | None = None
    flags: dict[str, bool]
