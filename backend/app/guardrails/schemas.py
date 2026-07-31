from typing import Callable, TypeVar

from pydantic import BaseModel, ValidationError

T = TypeVar("T", bound=BaseModel)


class GuardrailViolation(Exception):
    pass


def validate_agent_output(
    raw: dict,
    expected_model: type[T],
    reprompt_fn: Callable[[dict, str], dict] | None = None,
) -> T:
    try:
        return expected_model(**raw)
    except ValidationError as first_error:
        if reprompt_fn is None:
            raise GuardrailViolation(f"validation failed: {first_error}") from first_error
        retried = reprompt_fn(raw, str(first_error))
        try:
            return expected_model(**retried)
        except ValidationError as second_error:
            raise GuardrailViolation(f"validation failed after retry: {second_error}") from second_error
