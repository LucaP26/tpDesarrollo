from enum import StrEnum


class UserRole(StrEnum):
    CLIENTE = "cliente"
    DUENIO = "duenio"


class RegistrationStage(StrEnum):
    PRE_REGISTRO = "pre_registro"
    REGISTRO_COMPLETADO = "registro_completado"


class UserCategory(StrEnum):
    COMUN = "comun"
    ESPECIAL = "especial"
    PLATA = "plata"
    ORO = "oro"
    PLATINO = "platino"


class AuctionState(StrEnum):
    PROGRAMADA = "programada"
    ABIERTA = "abierta"
    CERRADA = "cerrada"


class Currency(StrEnum):
    ARS = "ARS"
    USD = "USD"


class PaymentType(StrEnum):
    CUENTA_BANCARIA = "cuenta_bancaria"
    TARJETA_CREDITO = "tarjeta_credito"
    CHEQUE_CERTIFICADO = "cheque_certificado"


class PaymentStatus(StrEnum):
    PENDIENTE = "pendiente"
    VERIFICADO = "verificado"
    RECHAZADO = "rechazado"


class BidStatus(StrEnum):
    CONFIRMADA = "confirmada"
    SUPERADA = "superada"
    GANADORA = "ganadora"
    RECHAZADA = "rechazada"


class ConsignmentStatus(StrEnum):
    BORRADOR = "borrador"
    ENVIADA = "enviada"
    EN_REVISION = "en_revision"
    PENDIENTE_CONFIRMACION = "pendiente_confirmacion"
    ACEPTADA = "aceptada"
    RECHAZADA = "rechazada"
    DEVUELTA = "devuelta"


class PenaltyStatus(StrEnum):
    ACTIVA = "activa"
    PAGADA = "pagada"
    JUDICIALIZADA = "judicializada"


class NotificationKind(StrEnum):
    INFO = "info"
    ALERTA = "alerta"
    OPERACION = "operacion"


CATEGORY_ORDER = {
    UserCategory.COMUN: 1,
    UserCategory.ESPECIAL: 2,
    UserCategory.PLATA: 3,
    UserCategory.ORO: 4,
    UserCategory.PLATINO: 5,
}
