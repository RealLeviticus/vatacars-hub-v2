export default async function fetcher<JSON = any>(input: RequestInfo, init?: RequestInit): Promise<JSON> {
    const res = await fetch(input, init);

    if (!res.ok) {
        const errorText = await res.text();
        throw new Error(errorText || 'An error occurred');
    }

    return res.json();
}
