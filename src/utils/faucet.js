export const callFaucet = async (address, chainId) => {
  try {
    const response = await fetch('/api/faucet', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ address, chainId }),
    });

    const data = await response.json();
    console.log('Faucet response:', data);
    return data;
  } catch (error) {
    console.error('Failed to call faucet:', error);
    throw error;
  }
};
