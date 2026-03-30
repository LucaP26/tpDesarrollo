from app.core.config import Settings
from app.services.admin import AdminService
from app.services.auctions import AuctionService
from app.services.auth import AuthService
from app.services.consignments import ConsignmentService
from app.services.email import EmailService
from app.services.metrics import MetricsService
from app.services.notifications import NotificationService
from app.services.realtime import RealtimeManager
from app.services.store import SqlServerStore


class ServiceContainer:
    def __init__(self, settings: Settings) -> None:
        self.store = SqlServerStore(settings)
        self.email = EmailService(settings)
        self.notifications = NotificationService(self.store)
        self.realtime = RealtimeManager()
        self.auth = AuthService(self.store, self.notifications, self.email)
        self.auctions = AuctionService(self.store, self.notifications, self.realtime)
        self.consignments = ConsignmentService(self.store, self.notifications)
        self.metrics = MetricsService(self.store)
        self.admin = AdminService(self.store, self.auctions, self.notifications)
