import { Currency, PaymentMethod, UserCategory } from "./types";

type CategoryProgress = {
  currentLabel: string;
  nextLabel: string | null;
  summary: string;
  detail: string;
  paymentsLoaded: number;
  auctionsJoined: number;
  reachedTop: boolean;
};

export const homeShowcase = [
  {
    image:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuB5LARaC_TJMJVvlEnOzvScvE4xtzkcaUntBDjVN_sMBjxWQh7RylWdsLWKnZioCipZWO1IFgKdOOZ3AEnaovdTH0SFVswXczwzLJJudJbPYryIPq8wh6Nsy4wRRulR2sCvqxtXNjJqV9F9odyrW-otZtEWamb1Llj2PpWGiAkezeCkIa79xZn3XnSrp-HZyxsxs9yMmv4nTiZYPNd8Rx2a2f5tT90M_1QTzkYqabPlN4Pkobd1AWMaTrVZCyc3a1o_m0P09f680xk",
    badge: "Cierra pronto",
    title: "Patek Philippe 1952",
    subtitle: "Ref. 2499 calendario perpetuo",
    price: "$1,200,000"
  },
  {
    image:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuBcjVDbE7LDU8mqxNx9Ok0QVsg5DpTg9rRwcTB1axOvQ3Ks4u9NYzCNggG5hsBe43A-DXC4YI8w6b0oQ1tPl4yWbgePqkpUqWg-2qQ-kc_T9Lpwws-UTJE7nunjsNPbvYZW0QP5y_NeN_szl6gJQM8q7Ge1Ztgxdd1ntUmQ5WdbnAJN4t1kPfKbufVYrOcN0GvB_Pwh9FMEhPbewQW9mm47SpOPLQY_zuef5PwDcIWW98bhD-uIzoPYY9UDnkPYEo4O34YucnbZJNU",
    badge: "Oferta privada",
    title: "Ferrari 250 GTO",
    subtitle: "Chasis Berlinetta 1963",
    price: "$42,500,000"
  }
];

export const browseArtwork = [
  "https://lh3.googleusercontent.com/aida-public/AB6AXuDuXa78vK99TX57FYQYQLR7UNOEZnbddN0V93_Gs8BaUNObZvAtkaOUmqtZTJL9olfrM_6CyW7N79AHAhGReGA9k2zNaqlglPUTPTyzdQIMpz9Igo_4-o4mvBUg9CK1oXBwLSBwwBfDg04261DR0QTJe6Xv1lTDmDl1q9vCT8-oa4RAjSAi63A8ZKpSVDSYAy6C_NTeCLIEGxJeLOUgpH0xooyTjHYj8U-FzdD2uoLFqVid9LaeHokpC-aB3Ni1TQ2OgJuOl1aWn3o",
  "https://lh3.googleusercontent.com/aida-public/AB6AXuAYegz3zQiIs4GvZrF0wbiy8VtnWjmA7ABlNTdtt4dbuYTYEyuQUEJM-qsgkaWZGIN462VD2Mr1NqJBv8564EYveqXgsoj5p81bGWY0X4kwL80o7_MogUSlRIN0CNyNoVcrDybcpyI-RFDBI0_SfszdjbKgl6Uxz8tVAUXNuHb4qE8_4e0ypa0oPFgHSPxTU-un-RbenYuCZm8GuQB5ZYyaFt-ogBg3IOPO9tUwS5Cs7fuDp_sTx2rR0QdTyQi7_cRNENkLM4fs3H8",
  "https://lh3.googleusercontent.com/aida-public/AB6AXuCjKu7dEM8wYCepHZ9qf_DtLSadiGB-2b0cdpjtFitdyWgS6EVIAfVnMpoYWTYATfWv62qQbhVBJQ1-qhpRr4PwS5thaEnXfQb4WHbD21SLKJKk0ej7I_TP382fBPHl2VOjMkn4gui7UiSG5J-CquwEW4KpdayQ6IpbLBcvSWkyD8Dx8iy_jsAH9sti_TztgufMq2BBcjSXJMDzj23SdNQq7c-THa6ew5LV4OHleO_DyXvh3eiXxRF0winhE89AmRxIexfVWTDGXhw",
  "https://lh3.googleusercontent.com/aida-public/AB6AXuDlWtIG3MoyPEDZSaBSo64r7yeaeDZkxuZn4phb4_kgEqz6qRJxR3upA3HjDXxyb4GxT2uCV-RdOONbKmdaFpZwVr8sSqdnei_7aB0Uw9hcyYZxgQSk9PqvipsVEj_HzME4J8kIToHykHes2-LfoOlF0MYrHFIcXNmiuZ1JnxWfmuUUiBkqCoDQLYbAEB4AXdEfUCTlRQJ3q72G0i4EKiC9puBI4-073buVgAkQ8e8h5ntVCUjd1gH315v_3gztBzbgdYflFV-fvAI"
];

export const countryOptions = [
  { label: "Argentina", code: 32 },
  { label: "Reino Unido", code: 826 },
  { label: "Estados Unidos", code: 840 },
  { label: "Suiza", code: 756 },
  { label: "Francia", code: 250 }
];

export function avatarFromSeed(seed: string): string {
  return `https://i.pravatar.cc/300?u=${encodeURIComponent(seed)}`;
}

export function profileAvatar(avatarImageUrl: string | null | undefined, seed: string): string {
  if (avatarImageUrl?.trim()) {
    return avatarImageUrl;
  }
  return avatarFromSeed(seed);
}

export function memberLabel(category: UserCategory | string | undefined): string {
  switch (category) {
    case "platino":
      return "Platino";
    case "oro":
      return "Oro";
    case "plata":
      return "Plata";
    case "especial":
      return "Especial";
    default:
      return "Comun";
  }
}

export function categoryProgress(
  category: UserCategory | string | undefined,
  paymentsLoaded: number,
  auctionsJoined: number
): CategoryProgress {
  const normalizedCategory = (category ?? "comun") as UserCategory;
  const currentLabel = memberLabel(normalizedCategory);

  if (normalizedCategory === "platino") {
    return {
      currentLabel,
      nextLabel: null,
      summary: "Ya alcanzaste la categoria mas alta.",
      detail: `Participaste en ${auctionsJoined} subastas y tienes ${paymentsLoaded} medios de pago cargados.`,
      paymentsLoaded,
      auctionsJoined,
      reachedTop: true
    };
  }

  if (normalizedCategory === "oro") {
    const missingAuctions = Math.max(0, 10 - auctionsJoined);
    const missingPayments = Math.max(0, 3 - paymentsLoaded);
    const detailParts = [];
    if (missingAuctions > 0) {
      detailParts.push(`${missingAuctions} subasta${missingAuctions === 1 ? "" : "s"}`);
    }
    if (missingPayments > 0) {
      detailParts.push(`${missingPayments} medio${missingPayments === 1 ? "" : "s"} de pago`);
    }

    return {
      currentLabel,
      nextLabel: "Platino",
      summary: "Siguiente categoría: Platino.",
      detail: detailParts.length
        ? `Para subir te faltan ${detailParts.join(" y ")}.`
        : "Ya cumples los requisitos y tu categoria se actualizara al refrescar tu perfil.",
      paymentsLoaded,
      auctionsJoined,
      reachedTop: false
    };
  }

  if (normalizedCategory === "plata") {
    const missingAuctions = Math.max(0, 8 - auctionsJoined);
    return {
      currentLabel,
      nextLabel: "Oro",
      summary: "Siguiente categoría: Oro.",
      detail:
        missingAuctions > 0
          ? `Te faltan ${missingAuctions} subasta${missingAuctions === 1 ? "" : "s"} participada${missingAuctions === 1 ? "" : "s"}.`
          : "Ya cumples los requisitos y tu categoria se actualizara al refrescar tu perfil.",
      paymentsLoaded,
      auctionsJoined,
      reachedTop: false
    };
  }

  if (normalizedCategory === "especial") {
    const missingPayments = Math.max(0, 5 - paymentsLoaded);
    const missingAuctions = Math.max(0, 5 - auctionsJoined);
    return {
      currentLabel,
      nextLabel: "Plata",
      summary: "Siguiente categoría: Plata.",
      detail:
        missingPayments === 0 || missingAuctions === 0
          ? "Ya cumples una de las condiciones y tu categoria se actualizara al refrescar tu perfil."
          : `Te faltan ${missingPayments} medios de pago o ${missingAuctions} subastas participadas.`,
      paymentsLoaded,
      auctionsJoined,
      reachedTop: false
    };
  }

  const missingPayments = Math.max(0, 3 - paymentsLoaded);
  const missingAuctions = Math.max(0, 1 - auctionsJoined);
  return {
    currentLabel,
    nextLabel: "Especial",
    summary: "Siguiente categoría: Especial.",
    detail:
      missingPayments === 0 || missingAuctions === 0
        ? "Ya cumples una de las condiciones y tu categoria se actualizara al refrescar tu perfil."
        : `Te faltan ${missingPayments} medios de pago o ${missingAuctions} subasta participada.`,
    paymentsLoaded,
    auctionsJoined,
    reachedTop: false
  };
}

export function browseStatus(bestOffer: number | null | undefined, index: number): { label: string; tone: "accent" | "slate" } {
  if (bestOffer) {
    return { label: "Activa", tone: "accent" };
  }
  if (index === 0) {
    return { label: "Activa", tone: "accent" };
  }
  return { label: "Comienza pronto", tone: "slate" };
}

export function formatMoney(currency: Currency, amount: number | null | undefined): string {
  if (amount == null) {
    return currency === "USD" ? "$18,000" : "$15,000";
  }
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency,
    maximumFractionDigits: 0
  }).format(amount);
}

export function formatEventDate(value: string): string {
  const date = new Date(value);
  return new Intl.DateTimeFormat("es-AR", {
    month: "short",
    day: "numeric"
  }).format(date);
}

export function paymentSubtitle(payment: PaymentMethod): string {
  const holderName = [payment.holder_first_name, payment.holder_last_name].filter(Boolean).join(" ").trim();
  if (payment.type === "tarjeta_credito" && payment.expiration_date) {
    return `Vence ${payment.expiration_date}`;
  }
  if (payment.type === "cuenta_bancaria") {
    const bankLabel = payment.issuing_bank ?? payment.display_name;
    return `${bankLabel} · ${payment.currency}`;
  }
  if (holderName) {
    return `Titular: ${holderName}`;
  }
  if (payment.last_four) {
    return `Terminada en ${payment.last_four}`;
  }
  return `${payment.currency} ${payment.available_amount.toLocaleString("es-AR")}`;
}
