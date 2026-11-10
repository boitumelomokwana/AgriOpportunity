export function delay(ms = 350): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

export function maybeFail(): void {
  if (process.env.EXPO_PUBLIC_SIMULATE_ERROR === '1') {
    throw new Error('Unable to load opportunity data. Please try again.');
  }
}
