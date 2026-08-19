type CurrencyAmount = {
  value: number
  currency: string
}

export const formatCurrency = (
  { value, currency }: CurrencyAmount,
  locale: string = navigator.language,
): string => {
  const formattedValue = new Intl.NumberFormat(locale).format(value)

  return currency ? `${formattedValue} ${currency}` : formattedValue
}
