
import { GoogleGenAI } from "@google/genai";
import { RDData } from "../types";

// Initialize Gemini
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

/**
 * Generates a summary report for the CCO based on selected RDs (Operational View).
 */
export const generateDailyReportSummary = async (rds: RDData[]): Promise<string> => {
  try {
    if (rds.length === 0) return "Nenhum RD selecionado para análise.";

    // Prepare data for AI analysis
    const dataSummary = rds.map(rd => ({
      category: rd.serviceCategory,
      location: `${rd.street}, ${rd.neighborhood}`,
      metrics: rd.metrics,
      teamPresent: rd.teamAttendance.filter(a => a.present).length,
      totalTeam: rd.teamAttendance.length,
      status: rd.status
    }));

    const prompt = `
      Atue como um analista de operações da empresa Ciclus.
      Você recebeu um array de Relatórios Diários (RD) contendo produção de Capinação, Pintura e Roçagem.
      
      Dados:
      ${JSON.stringify(dataSummary, null, 2)}

      Gere um relatório executivo (pt-BR) contendo:
      1. **Totais Gerais**: Some todos os metros de capina, metros de pintura, unidades de postes e m² de roçagem separadamente.
      2. **Produtividade da Equipe**: Identifique se alguma equipe teve produção muito baixa para o número de pessoas presentes.
      3. **Insights**: Sugira onde focar amanhã baseado no que foi feito hoje.

      Use formatação Markdown. Seja direto e objetivo.
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
    });

    return response.text || "Não foi possível gerar o resumo.";
  } catch (error: any) {
    console.error("Error generating report:", error);
    return "Erro ao conectar com o assistente de IA.";
  }
};

/**
 * Generates a High-Level Strategic Dashboard Analysis (Managerial View).
 */
export const generateStrategicAnalysis = async (
  totalMetrics: any, 
  efficiencyData: any,
  metaAnalysis: any
): Promise<string> => {
  try {
    const prompt = `
      Você é um Consultor de Business Intelligence Sênior da Ciclus.
      Analise os seguintes dados consolidados da operação de limpeza urbana.
      
      **Contexto da Meta:** A meta diária por equipe é de 1.95 km (1950 metros) lineares.
      
      **Métricas Acumuladas (KPIs):**
      ${JSON.stringify(totalMetrics, null, 2)}
      
      **Análise da Meta (Dias que batemos a meta vs Dias abaixo):**
      ${JSON.stringify(metaAnalysis, null, 2)}
      
      **Eficiência por Supervisor (Quem produz mais):**
      ${JSON.stringify(efficiencyData, null, 2)}
      
      Gere uma análise curta e direta em Markdown abordando:
      1. **Performance Geral**: Estamos batendo a meta de 1.95km consistentemente?
      2. **Gargalos**: Identifique se há dias específicos ou supervisores com baixo rendimento.
      3. **Destaque**: Quem é o supervisor mais eficiente.
      4. **Ação Estratégica**: O que deve ser feito para melhorar a média diária.
      
      Não use saudações. Vá direto aos pontos. Use emojis para destacar tópicos.
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
    });

    return response.text || "Análise indisponível.";
  } catch (error: any) {
    console.error("Error generating strategy:", error);
    return "Erro na análise estratégica.";
  }
};
