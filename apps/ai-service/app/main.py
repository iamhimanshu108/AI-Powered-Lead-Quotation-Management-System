from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field
import os

app = FastAPI(
    title='AI Lead & Quotation Service',
    version='0.1.0',
    description='AI-powered summaries, quotation drafts, and follow-up email generation for the sales workflow.',
)


class LeadSummaryRequest(BaseModel):
    requirement_description: str = Field(..., min_length=10)
    follow_up_notes: str = Field(default='')


class LeadSummaryResponse(BaseModel):
    summary: str
    customer_needs: list[str]
    possible_risks: list[str]
    suggested_questions: list[str]
    ai_generated: bool = True


class ProductSuggestion(BaseModel):
    product_id: str
    quantity: int | None = None
    rationale: str


class QuotationDraftRequest(BaseModel):
    customer_requirements: str = Field(..., min_length=10)
    product_catalogue: list[dict]


class QuotationDraftResponse(BaseModel):
    suggested_products: list[ProductSuggestion]
    clarification_questions: list[str]
    draft_notes: str
    ai_generated: bool = True


class FollowUpEmailRequest(BaseModel):
    lead_name: str
    quotation_status: str
    customer_history: str = ''
    summary: str = ''


class FollowUpEmailResponse(BaseModel):
    subject: str
    body: str
    ai_generated: bool = True


@app.get('/api/health')
def health_check():
    return {
        'status': 'ok',
        'service': 'ai-lead-quotation-service',
        'timestamp': '2026-01-01T00:00:00Z',
    }


@app.post('/api/ai/lead-summary', response_model=LeadSummaryResponse)
def lead_summary(payload: LeadSummaryRequest):
    if not payload.requirement_description.strip():
        raise HTTPException(status_code=400, detail='Requirement description is required.')

    summary = payload.requirement_description.strip()
    return LeadSummaryResponse(
        summary=f"Customer is looking for {summary[:120]}...",
        customer_needs=['Needs a tailored solution', 'Wants a clear commercial proposal'],
        possible_risks=['Budget sensitivity', 'Tight decision timeline'],
        suggested_questions=['What is the expected project timeline?', 'What constraints affect the budget?'],
    )


@app.post('/api/ai/quotation-draft', response_model=QuotationDraftResponse)
def quotation_draft(payload: QuotationDraftRequest):
    if not payload.customer_requirements.strip():
        raise HTTPException(status_code=400, detail='Customer requirements are required.')

    if not payload.product_catalogue:
        raise HTTPException(status_code=400, detail='A non-empty product catalogue is required for a draft quotation.')

    submitted_products = payload.product_catalogue[:3]
    suggestions = [
        ProductSuggestion(
            product_id=str(item.get('product_id') or item.get('sku') or 'UNKNOWN'),
            quantity=item.get('suggested_quantity') or 1,
            rationale='Best-fit option for the requested requirement.',
        )
        for item in submitted_products
    ]

    return QuotationDraftResponse(
        suggested_products=suggestions,
        clarification_questions=['Do you want a standard or premium variant?', 'Is there a preferred delivery timeline?'],
        draft_notes='This draft requires a human review before it is saved or sent.',
    )


@app.post('/api/ai/follow-up-email', response_model=FollowUpEmailResponse)
def follow_up_email(payload: FollowUpEmailRequest):
    subject = f'Follow-up for {payload.lead_name}'
    body = (
        f"Hi {payload.lead_name},\n\n"
        f"Thank you for your continued interest. We are currently reviewing the status of your quotation ({payload.quotation_status}).\n\n"
        f"{payload.summary or payload.customer_history or 'We would be happy to discuss next steps and answer any questions.'}\n\n"
        "Please let us know a convenient time to continue the conversation."
    )
    return FollowUpEmailResponse(subject=subject, body=body)
