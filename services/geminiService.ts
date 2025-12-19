
import { GoogleGenAI } from "@google/genai";
import { RDData } from "../types";

// Fix: Initialize the Google GenAI client exclusively from process.env.API_KEY as per guidelines
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

/**
 * Generates a summary report for the CCO based on selected RDs (Operational View).
 */
export const generateDailyReportSummary = async (rds: RDData[]): Promise<string> => {
  try {
    if (rds.length === 0) return "Nenhum RD selecionado para análise.";

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
      Dados: ${JSON.stringify(dataSummary, null, 2)}
      Gere um relatório executivo em Markdown contendo Totais Gerais, Produtividade e Insights.
    `;

    // Fix: Updated model usage and result extraction to use the .text property
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
      Você é um Consultor de BI da Ciclus.
      Métricas: ${JSON.stringify(totalMetrics, null, 2)}
      Metas: ${JSON.stringify(metaAnalysis, null, 2)}
      Eficiência: ${JSON.stringify(efficiencyData, null, 2)}
      Gere uma análise estratégica em Markdown sobre performance, gargalos e ações necessárias.
    `;

    // Fix: Updated model usage and result extraction to use the .text property
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
    });

    return response.text || "Análise estratégica indisponível.";
  } catch (error: any) {
    console.error("Error generating strategy:", error);
    return "Erro na análise estratégica.";
  }
};
