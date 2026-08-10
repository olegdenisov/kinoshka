type CurrencyAmount = {
  value: number
  currency: string
}

export const formatCurrency = ({ value, currency }: CurrencyAmount): string => {
  const formattedValue = new Intl.NumberFormat('en-US').format(value)

  return currency ? `${formattedValue} ${currency}` : formattedValue
}
