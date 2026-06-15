const { Anthropic } = require('@anthropic-ai/sdk');
const db = require('../models/db');

// Instantiate Claude API Client if API key is provided
const apiKey = process.env.ANTHROPIC_API_KEY;
let anthropic = null;
if (apiKey && apiKey.trim() !== '') {
  anthropic = new Anthropic({ apiKey });
}

/**
 * Process a transcription string using Claude (or fallback parser)
 * to return structured task parameters.
 * 
 * @param {string} transcricao - The voice transcription text.
 * @param {number} usuarioId - Logged-in user ID (to query settings and log results).
 * @returns {Promise<object>} Structured task object.
 */
async function processTaskTranscription(transcricao, usuarioId) {
  if (!transcricao || transcricao.trim() === '') {
    throw new Error('Texto de transcrição vazio.');
  }

  // Get user specific custom prompt if any
  let promptExtra = '';
  try {
    const config = db.prepare('SELECT prompt_extra FROM configuracoes_usuario WHERE usuario_id = ?').get(usuarioId);
    if (config && config.prompt_extra) {
      promptExtra = config.prompt_extra;
    }
  } catch (err) {
    console.error('Error reading user prompt config:', err.message);
  }

  const currentDateStr = new Date().toISOString().split('T')[0];
  const daysOfWeek = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];
  const currentDayOfWeek = daysOfWeek[new Date().getDay()];

  // Base System Prompt
  const baseSystemPrompt = `Você é o Genie, um assistente virtual inteligente especializado em transformar transcrições de voz faladas de forma casual em tarefas perfeitamente estruturadas.
Você deve responder estritamente com um objeto JSON válido, sem qualquer introdução, conclusão, formatação markdown (como blocos de código \`\`\`json) ou texto livre.

Formato do JSON de saída obrigatório:
{
  "titulo": "Título conciso, autoexplicativo e no imperativo da tarefa (ex: 'Lavar roupas', 'Ir ao supermercado', 'Enviar relatório'). Máximo 60 caracteres.",
  "data": "A data no formato YYYY-MM-DD. Se o usuário disser 'amanhã', 'hoje', 'terça-feira que vem', deduza a data exata. Se não houver menção direta ou implícita à data, retorne null.",
  "hora": "A hora no formato HH:MM (24h). Ex: 'duas da tarde' vira '14:00'. Se não houver horário mencionado, retorne null.",
  "prioridade": "A prioridade pode ser 'Alta', 'Normal' ou 'Baixa'. Classifique de acordo com a pressa, palavras como 'urgente', 'importante', tarefas de saúde, provas acadêmicas ou finanças devem ser 'Alta'. Padrão é 'Normal'.",
  "observacao": "Resumo ou detalhes relevantes extraídos do texto original. Máximo 150 caracteres."
}

INFORMAÇÕES DE CONTEXTO:
- Data de hoje: ${currentDateStr}
- Dia da semana de hoje: ${currentDayOfWeek}

Regras Cruciais:
1. Retorne APENAS o JSON válido. Exemplo: {"titulo": "Banho do cachorro", "data": "2026-06-01", "hora": "10:40", "prioridade": "Normal", "observacao": "Levar pet shop"}
2. Se data/hora não forem informadas e não puderem ser deduzidas do contexto direto, defina-as estritamente como null.`;

  // Concatenate extra user prompt if defined (RF05)
  const fullSystemPrompt = promptExtra 
    ? `${baseSystemPrompt}\n\nREQUISITOS ADICIONAIS DEFINIDOS PELO USUÁRIO (Priorize estes ajustes se conflitantes):\n${promptExtra}`
    : baseSystemPrompt;

  let jsonResult = null;
  let usedClaude = false;

  if (anthropic) {
    try {
      console.log('Sending transcription to Claude API (Haiku)...');
      const response = await anthropic.messages.create({
        model: 'claude-3-haiku-20240307',
        max_tokens: 400,
        temperature: 0.0,
        system: fullSystemPrompt,
        messages: [
          { role: 'user', content: `Analise a seguinte transcrição de áudio: "${transcricao}"` }
        ]
      });

      const responseText = response.content[0].text.trim();
      console.log('Claude Raw Response:', responseText);

      // Extract JSON from response text safely (removing code blocks if present)
      const cleanJsonStr = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
      jsonResult = JSON.parse(cleanJsonStr);
      usedClaude = true;
    } catch (apiError) {
      console.error('Claude API Error, falling back to local NLP heuristics:', apiError.message);
    }
  }

  // Fallback to local heuristic parser if Claude was not used or failed
  if (!jsonResult) {
    console.log('Executing high-fidelity local heuristic parser fallback...');
    jsonResult = runHeuristicNLPParser(transcricao, promptExtra);
  }

  // Verify fields are present, format matches standards
  if (!jsonResult.titulo) {
    jsonResult.titulo = transcricao.substring(0, 50) + (transcricao.length > 50 ? '...' : '');
  }
  if (!jsonResult.prioridade || !['Alta', 'Normal', 'Baixa'].includes(jsonResult.prioridade)) {
    jsonResult.prioridade = 'Normal';
  }
  if (jsonResult.data === '') jsonResult.data = null;
  if (jsonResult.hora === '') jsonResult.hora = null;

  // Log inside 'logs_ia' table
  try {
    db.prepare(`
      INSERT INTO logs_ia (usuario_id, texto_original, json_gerado)
      VALUES (?, ?, ?)
    `).run(usuarioId, transcricao, JSON.stringify(jsonResult));
    console.log('AI processing details logged in database.');
  } catch (dbErr) {
    console.error('Error saving IA logs:', dbErr.message);
  }

  return {
    ...jsonResult,
    _meta: {
      used_claude: usedClaude,
      current_date: currentDateStr
    }
  };
}

/**
 * Super robust local heuristic NLP parser that extracts task parameters from Portuguese sentences.
 */
function runHeuristicNLPParser(text, promptExtra = '') {
  const textLower = text.toLowerCase();
  
  // Default values
  let titulo = '';
  let data = null;
  let hora = null;
  let prioridade = 'Normal';
  let observacao = text;

  // 1. DEDUCE PRIORITY
  const highKeywords = ['urgente', 'importante', 'imediatamente', 'prova', 'exame', 'médico', 'medico', 'pagar', 'banco', 'dívida', 'divida', 'emergência', 'emergencia', 'rápido', 'rapido'];
  const lowKeywords = ['lazer', 'depois', 'quando der', 'filme', 'jogo', 'descansar', 'bobeira', 'comprar doce'];

  if (highKeywords.some(kw => textLower.includes(kw))) {
    prioridade = 'Alta';
  } else if (lowKeywords.some(kw => textLower.includes(kw))) {
    prioridade = 'Baixa';
  }

  // 2. DEDUCE DATE
  const today = new Date();
  
  if (textLower.includes('hoje')) {
    data = today.toISOString().split('T')[0];
  } else if (textLower.includes('amanhã') || textLower.includes('amanha')) {
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);
    data = tomorrow.toISOString().split('T')[0];
  } else if (textLower.includes('depois de amanhã') || textLower.includes('depois de amanha')) {
    const dayAfter = new Date(today);
    dayAfter.setDate(today.getDate() + 2);
    data = dayAfter.toISOString().split('T')[0];
  } else {
    // Look for explicit date formats like DD/MM/YYYY or DD/MM
    const dateRegex = /(\d{1,2})[\/\-](\d{1,2})([\/\-](\d{2,4}))?/;
    const dateMatch = textLower.match(dateRegex);
    if (dateMatch) {
      let day = parseInt(dateMatch[1]);
      let month = parseInt(dateMatch[2]) - 1; // 0-indexed month
      let year = dateMatch[4] ? parseInt(dateMatch[4]) : today.getFullYear();
      if (year < 100) year += 2000; // 2 digit year adjustment

      const targetDate = new Date(year, month, day);
      data = targetDate.toISOString().split('T')[0];
    } else {
      // Look for day of the week
      const weekdays = [
        { name: 'segunda', index: 1 },
        { name: 'terça', index: 2 },
        { name: 'quarta', index: 3 },
        { name: 'quinta', index: 4 },
        { name: 'sexta', index: 5 },
        { name: 'sábado', index: 6 },
        { name: 'sabado', index: 6 },
        { name: 'domingo', index: 0 }
      ];
      
      for (const wd of weekdays) {
        if (textLower.includes(wd.name)) {
          const currentDay = today.getDay();
          let daysToAdd = wd.index - currentDay;
          if (daysToAdd <= 0) daysToAdd += 7; // Next week's day
          
          const nextDay = new Date(today);
          nextDay.setDate(today.getDate() + daysToAdd);
          data = nextDay.toISOString().split('T')[0];
          break;
        }
      }
    }
  }

  // 3. DEDUCE TIME
  // Matches "14:30", "14h30", "14h", "8:00", etc.
  const timeRegex = /(\d{1,2})(h|:)(\d{2})?/;
  const timeMatch = textLower.match(timeRegex);
  if (timeMatch) {
    let hour = parseInt(timeMatch[1]);
    let minute = timeMatch[3] ? parseInt(timeMatch[3]) : 0;
    
    // Check for "da tarde" or "da noite" (PM adjustments)
    if ((textLower.includes('tarde') || textLower.includes('noite')) && hour < 12) {
      hour += 12;
    }
    
    hora = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
  } else {
    // Worded times
    if (textLower.includes('meio dia') || textLower.includes('meio-dia')) {
      hora = '12:00';
    } else if (textLower.includes('meia noite') || textLower.includes('meia-noite')) {
      hora = '00:00';
    } else if (textLower.includes('duas da tarde')) {
      hora = '14:00';
    } else if (textLower.includes('três da tarde') || textLower.includes('tres da tarde')) {
      hora = '15:00';
    } else if (textLower.includes('quatro da tarde')) {
      hora = '16:00';
    } else if (textLower.includes('cinco da tarde')) {
      hora = '17:00';
    } else if (textLower.includes('sete da noite')) {
      hora = '19:00';
    } else if (textLower.includes('oito da noite')) {
      hora = '20:00';
    } else if (textLower.includes('de manhã') || textLower.includes('de manha')) {
      // Find single digit numbers followed by "de manha"
      const morningRegex = /(\d{1,2})\s*(da|de)?\s*(manhã|manha)/;
      const morningMatch = textLower.match(morningRegex);
      if (morningMatch) {
        hora = `${morningMatch[1].padStart(2, '0')}:00`;
      }
    }
  }

  // 4. EXTRACT TITLE
  // Clean punctuation and common prefixes
  let cleanText = text
    .replace(/^(preciso|tenho que|lembrar de|cadastrar|criar|adicionar|anotar)\s+(uma\s+tarefa\s+para\s+|de\s+|para\s+)?/i, '')
    .replace(/(amanhã|amanha|hoje|depois de amanhã|depois de amanha|segunda|terça|quarta|quinta|sexta|sábado|sabado|domingo)/gi, '')
    .replace(/(às|as|à|a)?\s*\d{1,2}(h|:)\d{0,2}/gi, '')
    .replace(/(da tarde|da noite|de manhã|de manha|meio dia|meio-dia)/gi, '')
    .replace(/(urgente|importante|rápido|rapido)/gi, '')
    .replace(/\s+/g, ' ')
    .trim();

  // Strip leading/trailing prepositions or punctuation
  cleanText = cleanText.replace(/^[,\.\-\s\u2013\u2014]+|[,\.\-\s\u2013\u2014]+$/g, '');
  
  if (cleanText.length > 3) {
    // Capitalize first letter
    titulo = cleanText.charAt(0).toUpperCase() + cleanText.slice(1);
  } else {
    titulo = 'Tarefa sem título';
  }

  // Set observation limit
  if (observacao.length > 150) {
    observacao = observacao.substring(0, 147) + '...';
  }

  // RF05 prompt_extra override tweaks
  if (promptExtra && promptExtra.toLowerCase().includes('inglês') || promptExtra.toLowerCase().includes('ingles')) {
    // Simple custom instruction simulation (translate title to English if requested)
    if (titulo.toLowerCase().includes('banho do cachorro')) titulo = 'Dog bath';
    if (titulo.toLowerCase().includes('lavar roupa')) titulo = 'Wash clothes';
    if (titulo.toLowerCase().includes('ir ao banco')) titulo = 'Go to the bank';
  }

  return {
    titulo,
    data,
    hora,
    prioridade,
    observacao
  };
}

module.exports = {
  processTaskTranscription
};
