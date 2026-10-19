"""Single-process localhost write serialization. Run uvicorn with ONE worker."""
from threading import RLock, BoundedSemaphore
mutation_lock = RLock()
processing_slots = BoundedSemaphore(2)
