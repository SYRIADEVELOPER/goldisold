export class GeoService {
  static async getCountryCode(): Promise<string | null> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout

      const response = await fetch('https://ipapi.co/json/', { signal: controller.signal });
      clearTimeout(timeoutId);

      if (!response.ok) throw new Error('Failed to fetch geolocation');
      const data = await response.json();
      return data.country_code || null;
    } catch (error) {
      console.error('Error detecting country:', error);
      return null;
    }
  }

  static getFlagUrl(countryCode: string): string {
    return `https://flagcdn.com/w40/${countryCode.toLowerCase()}.png`;
  }
}
