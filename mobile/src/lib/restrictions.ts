type RestrictionScope = "catalogo" | "puja";

export function buildRestrictionAlert(
  reason: string | null | undefined,
  scope: RestrictionScope
): { title: string; message: string } {
  const detail = reason?.trim() ?? "";

  if (detail.includes("categoria actual") || detail.includes("categoria igual o superior")) {
    return {
      title: scope === "catalogo" ? "Catalogo restringido" : "Puja no habilitada",
      message: detail
    };
  }

  if (detail.includes("no fue aprobada")) {
    return {
      title: "Cuenta pendiente de aprobacion",
      message: detail
    };
  }

  if (detail.includes("medio de pago verificado")) {
    return {
      title: "Medio de pago requerido",
      message: "Para pujar en esta subasta necesitas al menos un medio de pago verificado en la misma moneda."
    };
  }

  if (detail.includes("multa pendiente")) {
    return {
      title: "Puja bloqueada por multa",
      message: "Tenes una multa activa. Regularizala para volver a pujar."
    };
  }

  if (detail.includes("mas de una subasta")) {
    return {
      title: "Conexion no disponible",
      message: "No podes participar en mas de una subasta al mismo tiempo."
    };
  }

  return {
    title: scope === "catalogo" ? "Catalogo no disponible" : "No se puede pujar",
    message: detail || "Por el momento no podes realizar esta accion."
  };
}
