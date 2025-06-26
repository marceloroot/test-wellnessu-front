/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @next/next/no-img-element */
"use client";

import { useEffect, useRef, useState } from "react";

export default function App() {
  const [streamText, setStreamText] = useState("");
  const [videos, setVideos] = useState([]);

  const [isLoading, setIsLoading] = useState(true);
  const [question, setQuestion] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [finalHtml, setFinalHtml] = useState("");
  const [endpoint, setEndpoint] = useState("search-complete"); // Novo estado para o endpoint

  const [summaries, setSummaries] = useState<Record<string, string[]>>({});

  const lastCharRef = useRef("");
  const eventSourceRef = useRef<EventSource | null>(null);

  const startStream = (newQuestion: any) => {
    const q = newQuestion.trim();
    if (!q || isStreaming) return;

    setStreamText("");
    setVideos([]);
    setIsLoading(true);
    setIsStreaming(true);
    lastCharRef.current = "";
    setSummaries({});

    if (eventSourceRef.current) {
      (eventSourceRef.current as EventSource).close();
    }

    const url = `http://localhost:3333/${endpoint}?q=${encodeURIComponent(q)}`;
    const eventSource = new EventSource(url);
    eventSourceRef.current = eventSource;

    const safeTimeout = setTimeout(() => {
      console.warn("Timeout: Finalizando conexão por segurança.");
      setStreamText((prev) => prev + "\n\n[STREAM FINALIZADO POR SEGURANÇA]");
      setIsStreaming(false);
      eventSource.close();
    }, 60000);

    eventSource.addEventListener("videos", (e) => {
      try {
        const data = JSON.parse(e.data);

        if (!Array.isArray(data) || data.length === 0) {
          setStreamText(
            (prev) => prev + "\n\n[Nenhum vídeo encontrado para sua pergunta.]"
          );
          setIsLoading(false);
          setIsStreaming(false);
          eventSource.close();
          return;
        }

        setVideos(data);
        setIsLoading(false);
      } catch (err) {
        console.error("Erro ao parsear dados de vídeo:", err);
      }
    });

    eventSource.addEventListener("answer", (e) => {
      const currentChunk = e.data;
      const firstChar = currentChunk[0];

      let newText = currentChunk;

      if (
        lastCharRef.current &&
        firstChar &&
        /[a-zA-Z0-9]/.test(lastCharRef.current) &&
        /[a-zA-Z0-9]/.test(firstChar)
      ) {
        newText = " " + currentChunk;
      } else if (!lastCharRef.current) {
        newText = "\n" + currentChunk;
      }

      setStreamText((prev) => prev + newText);
      lastCharRef.current = currentChunk.slice(-1);
    });

    eventSource.addEventListener("summary", (e) => {
      try {
        const data = JSON.parse(e.data);
        const { videoId, content } = data;

        setSummaries((prev) => {
          const current = prev[videoId] || [];
          return {
            ...prev,
            [videoId]: [...current, content],
          };
        });
      } catch (err) {
        console.error("Erro ao parsear summary:", err);
      }
    });

    eventSource.addEventListener("end", () => {
      clearTimeout(safeTimeout);
      setFinalHtml(streamText);
      setIsStreaming(false);
      eventSource.close();
    });

    eventSource.onerror = (e) => {
      console.error("Erro SSE:", e);
      clearTimeout(safeTimeout);
      setStreamText((prev) => prev + "\n\n");
      setIsStreaming(false);
      eventSource.close();
    };
  };

  const handleSubmit = (e: any) => {
    e.preventDefault();
    setVideos([]);
    startStream(question);
  };

  useEffect(() => {
    return () => {
      const eventSource = eventSourceRef.current;
      if (eventSource) {
        eventSource.close();
      }
    };
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 text-gray-800 font-sans">
      <header className="bg-gradient-to-r from-blue-600 to-indigo-700 text-white shadow-lg p-6">
        <h1 className="text-3xl font-bold">Testing /search with SSE</h1>
        <p className="text-sm mt-2 opacity-90">
          Getting real-time feedback with videos and analytics
        </p>
      </header>

      {/* Campo de seleção de endpoint */}
      <section className="max-w-4xl mx-auto px-4 py-4">
        <label
          htmlFor="endpoint-select"
          className="block text-sm font-medium mb-2 text-gray-700"
        >
          Selecione o tipo de busca:
        </label>
        <select
          id="endpoint-select"
          value={endpoint}
          onChange={(e) => setEndpoint(e.target.value)}
          disabled={isStreaming}
          className="w-full px-4 py-2 rounded-md border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-gray-800"
        >
          <option value="search-complete">New API Endpoint</option>
          <option value="search">Legacy API Endpoint</option>
        </select>
      </section>

      {/* Campo de entrada */}
      <section className="max-w-4xl mx-auto px-4 py-2">
        <form
          onSubmit={handleSubmit}
          className="flex flex-col sm:flex-row gap-2"
        >
          <input
            type="text"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="Digite sua pergunta..."
            className="flex-grow px-4 py-2 rounded-md border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
            disabled={isStreaming}
          />
          <button
            type="submit"
            disabled={isStreaming}
            className={`px-4 py-2 rounded-md text-white bg-blue-600 hover:bg-blue-700 transition-colors ${
              isStreaming ? "opacity-50 cursor-not-allowed" : ""
            }`}
          >
            {isStreaming ? "Enviando..." : "Enviar"}
          </button>
        </form>
      </section>

      <main className="max-w-7xl mx-auto px-4 py-10 space-y-10">
        {/* Streaming Text Section */}
        <section>
          <h2 className="text-2xl font-semibold mb-4 text-gray-700">
            Real-Time Response
          </h2>
          <div className="bg-black text-green-400 p-6 rounded-lg font-mono text-sm h-80 overflow-y-auto border border-gray-700 shadow-inner prose prose-invert max-w-none">
            {streamText || finalHtml ? (
              <div
                dangerouslySetInnerHTML={{ __html: streamText || finalHtml }}
              />
            ) : (
              "Waiting for server response...."
            )}
          </div>
        </section>

        {/* Vídeos Section */}
        <section>
          <h2 className="text-2xl font-semibold mb-4 text-gray-700">
            Recommended Videos
          </h2>
          {isLoading ? (
            <p className="text-gray-500 italic">Loading videos...</p>
          ) : videos.length === 0 ? (
            <p className="text-gray-500 italic">No videos found.</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {videos.map((video: any, index) => (
                <div
                  key={index}
                  className="cursor-pointer bg-white rounded-lg overflow-hidden shadow-md hover:shadow-xl transition-shadow duration-300"
                >
                  <img
                    src={video.coverImage}
                    alt={`Thumbnail do vídeo ${index}`}
                    className="w-full h-40 object-cover"
                  />
                  <div className="p-4">
                    <h3 className="font-medium text-lg">{video.name}</h3>
                    <p className="text-sm text-gray-600 line-clamp-2">
                      {video.text}
                    </p>
                    <a
                      href={video.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-2 inline-block text-blue-600 hover:underline text-sm"
                    >
                      Assistir no site
                    </a>

                    {summaries?.[video?.videoId] &&
                      Array.isArray(summaries[video.videoId]) &&
                      summaries[video.videoId].length > 0 && (
                        <div className="mt-3 pt-2 border-t border-gray-200 prose prose-sm max-w-none text-xs text-gray-500">
                          <strong>Resumo:</strong>
                          <div
                            dangerouslySetInnerHTML={{
                              __html: summaries[video.videoId].join(" "),
                            }}
                          />
                        </div>
                      )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>

      <footer className="bg-gray-100 py-6 text-center text-gray-500 text-sm">
        &copy; {new Date().getFullYear()} - SSE Testing with Next.js and
        TailwindCSS
      </footer>
    </div>
  );
}
