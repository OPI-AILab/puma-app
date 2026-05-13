from enum import Enum
from typing import Optional, List, Any, Dict, Literal, Set
from pydantic import BaseModel, Field, field_validator, ConfigDict


class LoginRequest(BaseModel):
    username: str
    password: str


class UpdateFileRequest(BaseModel):
    url: Optional[str] = None
    license: Optional[str] = None
    attribution: Optional[str] = None


class SearchRequest(BaseModel):
    limit: Optional[int] = None
    offset: Optional[int] = None


class EvaluateRequest(BaseModel):
    model: str = Field()
    categories: List[str] = Field(default_factory=lambda: [c.name for c in CATEGORIES])
    continue_from: Optional[str] = None
    skip_ids: Optional[Set[str]] = None


class CreateEvaluationRequest(BaseModel):
    name: Optional[str] = None
    model_configuration: Dict = Field()
    categories: List[str] = Field(default_factory=lambda: [c.name for c in CATEGORIES])


class UpdateEvaluationConfigurationRequest(BaseModel):
    model_configuration: Dict = Field()


class StartEvaluationRequest(BaseModel):
    reset: bool = False


class ChatMessageType(str, Enum):
    TEXT = "text"
    FILE = "file"


class ConditionType(str, Enum):
    INCLUDE = "include"
    EXCLUDE = "exclude"
    ORDER = "order"
    REGEX = "regex",
    WACC = "wacc"
    STRUCT = "struct"
    OCR = "ocr"


class ChatMessage(BaseModel):
    type: ChatMessageType = None
    text: Optional[str] = None
    file: Optional[str] = None


class Condition(BaseModel):
    type: ConditionType = Field()
    expected: Any = Field()
    params: Dict = Field(default_factory=dict)


class StructuredField(BaseModel):
    name: str = Field()
    type: Literal["string", "number", "boolean", "array[string]", "array[number]", "array[boolean]"] = Field()
    description: Optional[str] = Field(default=None)


class StructuredOutput(BaseModel):
    name: str = Field(default="Object")
    fields: Optional[List[StructuredField]] = Field(default_factory=list)
    array: bool = Field(default=False)


class TaskDetails(BaseModel):
    id: str = None
    category: str = Field()
    tags: List[str] = Field(default_factory=list)
    content: List[ChatMessage] = Field(min_length=1)
    conditions: List[Condition] = Field()
    metadata: Optional[Dict[str, Any]] = None
    structured_output: Optional[StructuredOutput] = None

    @field_validator("category")
    def validate_category(cls, value):
        categories = {e.name for e in CATEGORIES}
        if value not in categories:
            raise ValueError("Category should be one of {}".format(", ".join(categories)))
        return value

    def first_text(self):
        for msg in self.content:
            if msg.type == ChatMessageType.TEXT:
                return msg.text
        return None

    def first_file(self):
        for msg in self.content:
            if msg.type == ChatMessageType.FILE:
                return msg.file
        return None

    def matches(self, req: EvaluateRequest):
        if req.skip_ids and self.id in req.skip_ids:
            return False
        if self.category not in req.categories:
            return False
        return True


class Category(BaseModel):
    name: str = None
    primaryColor: str = None
    secondaryColor: Optional[str] = None


class ModelDetails(BaseModel):
    id: str = Field()
    model_config = ConfigDict(extra="allow")


class ModelCategory(BaseModel):
    category: str = Field()
    selected: bool = Field()


class ModelProperties(BaseModel):
    categories: List[ModelCategory] = Field(default_factory=list)

    @field_validator("categories")
    def validate_categories(cls, value: List[ModelCategory]):
        categories = {e.name for e in CATEGORIES}
        for v in value:
            if v.category not in categories:
                raise ValueError("Category should be one of {}".format(", ".join(categories)))
        return value


class ModelDetailsAndProperties(BaseModel):
    details: ModelDetails = Field()
    properties: Optional[ModelProperties] = None


CATEGORIES = [
    Category(name="History and culture", secondaryColor="#F7CDCC", primaryColor="#FF3934"),
    Category(name="Contemporary life", secondaryColor="#D9E7FB", primaryColor="#3793ff"),
    Category(name="Geography and environment", secondaryColor="#FFE6CC", primaryColor="#FFB34D"),
    Category(name="ASR", secondaryColor="#D5E7D4", primaryColor="#4CAF50"),
    Category(name="Speech QA", secondaryColor="#d1ccff", primaryColor="#544c96"),
    Category(name="Sound and music QA", secondaryColor="#fff799", primaryColor="#aba239"),
    Category(name="OCR", secondaryColor="#e8bfff", primaryColor="#b83bff"),
    Category(name="Document QA", secondaryColor="#ded1ca", primaryColor="#534741"),
    Category(name="Structured extraction", secondaryColor="#ddf5ff", primaryColor="#0077a6"),
    Category(name="Video QA", primaryColor="#e91e90", secondaryColor="#fce4f2"),
]

CATEGORY_VERIFICATION_MAP = {
    "History and culture": ["include", "exclude", "order", "regex"],
    "Contemporary life": ["include", "exclude", "order", "regex"],
    "Geography and environment": ["include", "exclude", "order", "regex"],
    "ASR": ["wacc"],
    "Speech QA": ["include", "exclude", "order", "regex"],
    "Sound and music QA": ["include", "exclude", "order", "regex"],
    "OCR": ["ocr"],
    "Document QA": ["include", "exclude", "order", "regex"],
    "Structured extraction": ["struct"],
    "Video QA": ["include", "exclude", "order", "regex"],
}
