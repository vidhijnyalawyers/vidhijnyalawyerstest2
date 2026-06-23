import express from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json());

// Initialize Gemini client lazily to avoid startup crashes if key is initially absent
let aiClient: GoogleGenAI | null = null;
function getGeminiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === "MY_GEMINI_API_KEY") {
    return null;
  }
  if (!aiClient) {
    aiClient = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });
  }
  return aiClient;
}

// URL fetching helper for Legal Brief Summarizer
async function fetchUrlContent(url: string): Promise<string> {
  try {
    let formattedUrl = url.trim();
    if (!formattedUrl.startsWith('http://') && !formattedUrl.startsWith('https://')) {
      formattedUrl = `https://${formattedUrl}`;
    }
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000); // 6-second timeout bound
    const res = await fetch(formattedUrl, { 
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    });
    clearTimeout(timeoutId);
    if (!res.ok) {
      return `[Failed to retrieve resource directly, HTTP status: ${res.status}]`;
    }
    const html = await res.text();
    // Strip HTML scripts, styles, tags, and collapse spaces
    const textOnly = html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    return textOnly.substring(0, 10000); // Truncate cleanly for token safety
  } catch (err: any) {
    console.error(`Background fetch error for ${url}:`, err);
    return `[Resource retrieval offline due to standard container sandbox constraints or certificate limits. Details: ${err?.message || err}]`;
  }
}

// Legal Aid & Pro-Bono Intake Assessment API Endpoint
app.post("/api/evaluate-legal-aid", async (req, res) => {
  const { 
    name = "", 
    email = "", 
    projectName = "", 
    githubUrl = "", 
    budget = "0-10k", 
    primaryNeed = "open-source", 
    description = "", 
    language = "en" 
  } = req.body;

  if (!name.trim() || !email.trim() || !projectName.trim() || !description.trim()) {
    return res.status(400).json({ error: "Missing required core application fields." });
  }

  const ai = getGeminiClient();

  // Fallback to high-fidelity mock advisory assessment when no live Gemini API is provisioned
  if (!ai) {
    console.warn("GEMINI_API_KEY lacks active deployment. Utilizing localized pro-bono assessment fallback.");

    const mockEvaluations: Record<string, any> = {
      en: {
        title: `Clinical Suitability Intake: Project ${projectName}`,
        approved: budget !== 'over-100k',
        score: budget === 'over-100k' ? 45 : 92,
        consultationDate: "Thursday 10:00 AM UTC",
        advisoryOpinion: `Preliminary review indicates substantial public-utility and tech-justice suitability for Project ${projectName}. Decentralized governance protocol elements are heavily aligned with our pro-bono program. Risk exposure relates primarily to potential joint-and-several liability of voters and copyleft viral license hazards under GPL/AGPL families. (Note: Inject your GEMINI_API_KEY in system Settings to trigger live customized AI legal audits).`,
        remediationRoadmap: [
          "Deploy automated compliance scanners in CI/CD pipeline to block copyleft/viral license packages.",
          "Structure a legal wrapper (such as a Marshall Islands DAO LLC) to insulate key developers/contributors from personal civil liability.",
          "Construct standard Standard Contractual Clauses (SCCs) to govern any outgoing server-side telemetry logs."
        ],
        apiKeyMissing: true
      },
      zh: {
        title: `临床法律援助资格研判通报: 项目 ${projectName}`,
        approved: budget !== 'over-100k',
        score: budget === 'over-100k' ? 48 : 95,
        consultationDate: "星期五 下午 2:00 (UTC 时间)",
        advisoryOpinion: `通过对项目“${projectName}”技术描述的初步法学研判，该项目在去中心化开源基础设施及公共利益保护方向上显示了极高的社会价值。预算满足临床援助标准。其核心合规红线在于，去中心化钱包投票在普通法中易被穿透推定为普通合伙人关系。此外，任何未声明的跨境服务器遥测，都将面临严苛的GDPR限制。(温馨提示: 请在系统的 Secrets 面板中预置您的 GEMINI_API_KEY 以开启真实大模型专家研判报告)。`,
        remediationRoadmap: [
          "在集成第三方遥测包前，引入双向Cookie和位置双向隔离栏，彻底实现境外隐私隔离。",
          "尽快通过 Marshall Islands 注册正式的 DAO 法律实体外壳，确保贡献者不承担连带无限责任。",
          "开展开源代码库自动化集成扫描，对强传染性GPL代码依赖进行隔离解耦设计。"
        ],
        apiKeyMissing: true
      },
      ne: {
        title: `कार्यालय नि:शुल्क सहायता योग्यता रिपोर्ट: परियोजना ${projectName}`,
        approved: budget !== 'over-100k',
        score: budget === 'over-100k' ? 40 : 90,
        consultationDate: "सोमबार बिहान ९:०० UTC समय",
        advisoryOpinion: `परियोजना ${projectName} को प्रारम्भिक कानुनी मुल्यांकनले यो परियोजना हाम्रो नि:शुल्क परामर्श सेवाको लागि उपयुक्त भएको देखाउँछ। विकेन्द्रीकृत प्रणाली र खुला स्रोत प्रविधिहरू हाम्रो प्रो-बोनो कार्यक्रमसँग पूर्ण रूपमा मेल खान्छन्। यद्यपि, स्मार्ट करारको दायित्व र प्रयोगकर्ता डेटा स्थानान्तरण सम्बन्धी केही कानुनी चुनौतीहरू देखिन्छन्। (सूचना: वास्तविक समयमा एआई मार्फत विश्लेषण गर्न Settings मा GEMINI_API_KEY थप्नुहोस्।)`,
        remediationRoadmap: [
          "कुनै पनि कोड र डाटा स्थानान्तरण अघि प्रयोगकर्ताको स्पष्ट सहमति विन्डो थप गर्नुहोस्।",
          "विकासकर्ताहरू र संस्थापकहरूको व्यक्तिगत दायित्वहरू सीमित गर्न मार्शल टापुहरूमा औपचारिक कानूनी संरचना (DAO LLC) निर्माण गर्नुहोस्।",
          "कपिलाइट लाइसेन्स समस्याहरूबाट बच्न सफ्टवेयरका बाह्य प्याकेजहरूको अडिट गर्नुहोस्।"
        ],
        apiKeyMissing: true
      }
    };

    const sel = mockEvaluations[language] || mockEvaluations.en;
    return res.json(sel);
  }

  try {
    const sysInstruction = `You are an elite, socially motivated Technology Counsel, Pro-Bono Coordinator, and Venture Architect.
Your task is to analyze application files for technology pro-bono legal aid clinics, determine eligibility based on core public interest parameters (such as low budget, open-source compliance, or data-rights advocacy), and present a highly structured eligibility report.
Output strictly in the requested language. Language constraint: ${language === 'zh' ? 'Chinese (中文)' : language === 'ne' ? 'Nepali (नेपाली)' : 'English'}.`;

    const promptText = `
      Perform a professional eligibility audit on the following legal-aid application:
      - Applicant Name / Contact: ${name} (Email: ${email})
      - Project Name: ${projectName}
      - Repository/GitHub: ${githubUrl || "None provided"}
      - Primary Target Area: ${primaryNeed}
      - Annual Operational Budget: ${budget}
      - Project Core Description: ${description}

      Guidance Guidelines:
      - Approved status (approved: true) should be awarded to projects with a budget under $100k ('0-10k', '10k-50k', '50k-100k') which act as public utilities, open source libraries, privacy tools, or decentralized utilities.
      - If the budget is 'over-100k', they likely should be designated (approved: false) and encouraged to leverage paid consultation, while still receiving constructive roadmap feedback.
      - Make the 'advisoryOpinion' dense, legally precise, and specific to the technologies mentioned in their description. Choose a suited consultationDate (e.g., 'Thursday at 10 AM UTC' or similar).
      - Provide 3 detailed 'remediationRoadmap' steps.

      Output language: ${language === 'zh' ? 'Chinese' : language === 'ne' ? 'Nepali' : 'English'}.
      Format output strictly as a single JSON object matching our responseSchema.
    `;

    console.log(`Calling Gemini-3.5-flash to evaluate legal aid application for Project: ${projectName}...`);
    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: promptText,
      config: {
        systemInstruction: sysInstruction,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          required: ["approved", "score", "consultationDate", "title", "advisoryOpinion", "remediationRoadmap"],
          properties: {
            approved: { 
              type: Type.BOOLEAN, 
              description: "Whether the applicant is approved for legal aid representation (budget under 100k, values: 0-10k, 10k-50k, 50k-100k are eligible)" 
            },
            score: { 
              type: Type.INTEGER, 
              description: "Numeric rating from 1 to 100 assessing the social utility and legal alignment of the venture for clinical assistance" 
            },
            consultationDate: { 
              type: Type.STRING, 
              description: "Recommended day and slot (e.g. 'Monday at 9:00 AM UTC')" 
            },
            title: { 
              type: Type.STRING, 
              description: "An authoritative intake tile (e.g. 'Eligibility Decided: Lib-Telemetry Safeguards')" 
            },
            advisoryOpinion: { 
              type: Type.STRING, 
              description: "A professional technology-law analysis. Detail the legal frameworks (GPL, SEC, GDPR) and liability exposures relevant to their description." 
            },
            remediationRoadmap: {
              type: Type.ARRAY,
              description: "Three detailed legal or engineering mitigation targets the developers should achieve",
              items: { type: Type.STRING }
            }
          }
        },
        temperature: 0.15
      }
    });

    const reportText = response.text;
    if (!reportText) {
      throw new Error("No output generated from live Gemini eligibility assessor.");
    }

    const parsedReport = JSON.parse(reportText.trim());
    parsedReport.apiKeyMissing = false;
    res.json(parsedReport);

  } catch (error: any) {
    console.error("Gemini Legal-Aid evaluation fail:", error);
    res.status(500).json({ error: "Failed to evaluate application criteria. " + (error?.message || error) });
  }
});

// Legal Brief Summarizer API Endpoint
app.post("/api/summarize-brief", async (req, res) => {
  const { text = "", resourceLink = "", language = "en" } = req.body;

  if (!text.trim() && !resourceLink.trim()) {
    return res.status(400).json({ error: "Please paste a legal text brief or specify an address URL to summarize." });
  }

  const ai = getGeminiClient();

  // If no Gemini API is configured, return the high-fidelity mock summaries fallback
  if (!ai) {
    console.warn("GEMINI_API_KEY lacks active deployment. Utilizing localized mock summary fallback.");
    
    const mockSummaries: Record<string, any> = {
      en: {
        title: "Executive Synthesis: Regulatory Compliance Advisory",
        executiveSummary: "[SIMULATION BASELINE] This briefing outlines high-priority statutory risks, open-source viral licensures, and governance frameworks mapping to cryptographic systems and algorithmic deployments. Legal analysis reveals structural friction under cross-border data protection acts and model transparency auditing guidelines. (Note: Inject your GEMINI_API_KEY in Settings to enable real-time Gemini LLM summaries).",
        keyTakeaways: [
          "Protocol structures require formal legal wrapper setups to avoid absolute joint-and-several partner liability.",
          "Automated software dependency audits are critical to block viral licensures (GPLv3 / AGPL) from proprietary code assets.",
          "User tracking cookies and global data pipelines must deploy double opt-in geolocation compliance architectures."
        ],
        criticalRisks: [
          {
            risk: "GPL/AGPL Viral Ingestion",
            description: "Direct library linkage triggers source code disclosure mandates, contaminating proprietary IP.",
            severity: "HIGH"
          },
          {
            risk: "Regulatory Classification Hazard",
            description: "Token liquidity structures satisfying the Howey Test are subject to unregistered securities exposure.",
            severity: "HIGH"
          }
        ],
        actionableComplianceSteps: [
          "Refactor copyleft dependencies into microservices separating proprietary logical stacks.",
          "Restrict treasury payouts or dynamic utility features in restricted jurisdictions.",
          "Deploy user-conspicuous notifications denoting AI agent interactions."
        ],
        applicableLegislation: [
          "EU AI Act Art. 52 & 53",
          "GDPR Chapter V Cross-Border Flows",
          "SEC Exchange Act Section 5"
        ],
        apiKeyMissing: true
      },
      zh: {
        title: "合规高级行政要务通报",
        executiveSummary: "[合规模拟基线] 本简报深入阐述了针对算法系统及分布式资产的核心合规要求与高危法律红线。经法律系统初步评估，当前技术架构在跨国数据合规网格、AI模型训练透明度审计以及代币治理模型上面临潜在合规摩擦。(提示: 请在系统的 Secrets 控制面板中设置您的 GEMINI_API_KEY 以启动真实大模型法律研判功能)。",
        keyTakeaways: [
          "分布式治理架构（DAO）亟需配置马绍尔群岛或开曼群岛境外实体包装，防范投票人承担无限连带民事责任。",
          "技术开发团队必须引入CI/CD依赖安全网关，彻底阻断具有强传染性的开源许可证（如 GPLv2/v3、AGPL）并入专有库文件。",
          "深度集成人机交互代理时，需在交互界面显著位置加注可视化醒目标识，以符合算法透明披露义务。"
        ],
        criticalRisks: [
          {
            risk: "许可证传染扩散风险",
            description: "在同一微服务模块中静态编译或依赖传导传染性开源组件，可能被迫开源企业专有商业机密代码。",
            severity: "HIGH"
          },
          {
            risk: "涉嫌非法发售金融产品",
            description: "若有预期收益宣导、财库分红，治理代币极易被多国金融监管部门归类为未注册证券，带来高额行政处罚风险。",
            severity: "HIGH"
          }
        ],
        actionableComplianceSteps: [
          "将具有传染性质的组件重构剥离成完全独立的微服务，采用RESTful/gRPC远程调用。",
          "对涉及最终用户的交互系统立即配置Cookie明示双重选择同意控制栏。",
          "就跨境数据资产分布设立标准契约条款（SCCs）以应对GDPR执法合规审计。"
        ],
        applicableLegislation: [
          "欧盟人工智能法案 (EU AI Act) 第53条",
          "中国《生成式人工智能服务管理暂行办法》",
          "美国 SEC 证券交易法 Howey 判定标准"
        ],
        apiKeyMissing: true
      },
      ne: {
        title: "कार्यकारी सारांश: नियामक र कानूनी अनुपालन रिपोर्ट",
        executiveSummary: "[सिमुलेशन आधार रेखा] यस ब्रीफिंगले एल्गोरिथमिक प्रणालीहरू र वितरित डिजिटल सम्पत्तिहरूको नियामक जोखिमहरूलाई रूपरेखा गर्दछ। कानूनी विश्लेषणले सीमापार डाटा सुरक्षा र पारदर्शी अडिटिंग मापदण्डहरू अन्तर्गत केही कानुनी समस्याहरू देखाउँछ। (सूचना: वास्तविक समयमा Gemini मार्फत संक्षेपीकरण सक्षम गर्न Settings मा GEMINI_API_KEY थप्नुहोस्।)",
        keyTakeaways: [
          "संस्थापकहरू र मतदाताहरूको व्यक्तिगत दायित्वहरू सीमित गर्न मार्शल टापुहरू वा केम्यान टापुहरूमा औपचारिक कानूनी र्‍यापर संरचना आवश्यक छ।",
          "स्वामित्व सफ्टवेयरहरू सुरक्षित राख्न GPLv3 वा AGPL लाइसेन्स भएका खुला स्रोत कोडहरूलाई तुरुन्तै पहिचान गरी नियन्त्रण गर्नुपर्छ।",
          "प्रयोगकर्ता डेटा गोपनीयता र प्रणाली पहुँचका लागि भौगोलिक स्थान पहिचान गर्ने अनुपालन प्रविधि लागू गर्न आवश्यक छ।"
        ],
        criticalRisks: [
          {
            risk: "GPL/AGPL लाइसेन्स प्रदूषण",
            description: "स्वामित्व स्रोत कोडहरू प्रणालीमा गलत रूपमा एकीकृत भएमा व्यवसायिक कोडको गोपनीयता र कपीराइट जोखिममा पर्छ।",
            severity: "HIGH"
          },
          {
            risk: "अवैध वित्तीय उत्पादन वर्गीकरण",
            description: "टोकन प्रणालीहरूलाई दर्ता नगरिएका धितोपत्रहरू (Unregistered Securities) को रूपमा वर्गीकरण गरिने खतरा उच्च छ।",
            severity: "HIGH"
          }
        ],
        actionableComplianceSteps: [
          "खुला स्रोत प्रतिलिपि अधिकार भएका कोडहरूलाई मुख्य सफ्टवेयर प्रणालीहरूबाट छुट्टै ढाँचामा स्थानान्तरण गर्नुहोस्।",
          "कुनै पनि टोकन वा भुक्तानी प्रणालीमा लाभांश र प्रतिफल प्रतिज्ञाहरू विज्ञापन नगर्नुहोस्।",
          "प्रयोगकर्ताको स्पष्ट विकल्प सहमति बिना व्यक्तिगत डाटा र ब्राउजिङ इतिहास संकलन गर्न बन्द गर्नुहोस्।"
        ],
        applicableLegislation: [
          "EU AI Act Art. 52, 53",
          "GDPR क्रस-बोर्ड डाटा सुरक्षा नीति",
          "SEC Howey परीक्षण नियमहरू"
        ],
        apiKeyMissing: true
      }
    };

    const sel = mockSummaries[language] || mockSummaries.en;
    return res.json(sel);
  }

  try {
    let fetchedContent = "";
    if (resourceLink.trim()) {
      console.log(`Starting background resource fetch for Gemini summarizer: ${resourceLink}...`);
      fetchedContent = await fetchUrlContent(resourceLink);
    }

    const sysInstruction = `You are a highly analytical, specialized Technology Lawyer and Systems compliance Auditor with dual-degree credentials.
Your task is to analyze the user pased legal briefs, regulatory filings, contracts, or technology agreements, synthesize their raw scope, and generate a meticulously structured, legally rigorous executive summary.
Ensure all outputs strictly match the requested language. Language constraint: ${language === 'zh' ? 'Chinese (中文)' : language === 'ne' ? 'Nepali (नेपाली)' : 'English'}.`;

    const promptText = `
      Perform an elite corporate tech-compliance briefing synthesis on the provided material.
      Provide detailed legislative citations and technical advice.

      === pasted legal material ===
      ${text || "No custom text was pasted by the user."}

      === fetched online resource content ===
      ${fetchedContent || "No online content fetched."}

      === requested language ===
      Output must be strictly in: ${language === 'zh' ? 'Chinese' : language === 'ne' ? 'Nepali' : 'English'}.

      Fill out the output following our responseSchema. Format output strictly as a single JSON object.
    `;

    console.log(`Calling Gemini-3.5-flash to summarize brief in language: ${language}...`);
    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: promptText,
      config: {
        systemInstruction: sysInstruction,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          required: ["title", "executiveSummary", "keyTakeaways", "criticalRisks", "actionableComplianceSteps", "applicableLegislation"],
          properties: {
            title: { 
              type: Type.STRING, 
              description: "A short, authoritative, high-fidelity title for the summary (e.g., 'Regulatory Impact Analysis: Data Sovereignty Compliance')" 
            },
            executiveSummary: { 
              type: Type.STRING, 
              description: "A precise, dense executive summary paragraph (3-4 sentences) capturing the core issues, compliance status, and legal liabilities." 
            },
            keyTakeaways: {
              type: Type.ARRAY,
              description: "A solid list of 3 items detailing the most vital technical legal takeaways or rule highlights with precise section citations",
              items: { type: Type.STRING }
            },
            criticalRisks: {
              type: Type.ARRAY,
              description: "An array of 1 to 3 critical business or engineering risk exposures found in the text",
              items: {
                type: Type.OBJECT,
                required: ["risk", "description", "severity"],
                properties: {
                  risk: { type: Type.STRING, description: "Actionable title naming the compliance or litigation exposure" },
                  description: { type: Type.STRING, description: "Detailed analysis of regulatory penalties, civil liabilities, or technical gaps" },
                  severity: { type: Type.STRING, description: "Must be exactly HIGH, MEDIUM, or LOW" }
                }
              }
            },
            actionableComplianceSteps: {
              type: Type.ARRAY,
              description: "A step-by-step technical mitigation and remediation guide for engineering or product teams to follow",
              items: { type: Type.STRING }
            },
            applicableLegislation: {
              type: Type.ARRAY,
              description: "Meticulous legal frameworks, treaties, acts, or cases mentioned or relevant (e.g., GDPR Art. 49, EU AI Act, 15 U.S.C. § 1)",
              items: { type: Type.STRING }
            }
          }
        },
        temperature: 0.15
      }
    });

    const reportText = response.text;
    if (!reportText) {
      throw new Error("No output text received from live Gemini summarizer.");
    }

    const parsedReport = JSON.parse(reportText.trim());
    parsedReport.apiKeyMissing = false;
    res.json(parsedReport);

  } catch (error: any) {
    console.error("Gemini Legal Brief Summarizer failure:", error);
    res.status(500).json({ error: "Failed to compile AI brief summary. " + (error?.message || error) });
  }
});

// TechLaw Compliance Sandbox API Endpoint
app.post("/api/analyze-compliance", async (req, res) => {
  const { productDescription, sector, contextText, language = 'en' } = req.body;

  if (!productDescription) {
    return res.status(400).json({ error: "Product description or draft code/document is required as input." });
  }

  const ai = getGeminiClient();

  // Mapping sector to human readable context
  const sectorDescriptions: Record<string, string> = {
    'ai-governance': 'AI Governance & Model Compliance (Model safety, scraping, copyright, EU AI Act, transparency disclosure)',
    'smart-contracts': 'Smart Contract Law & Tokenomics (DAO wrappers, CFTC/SEC token classification, protocol exploit audit)',
    'ip-strategy': 'Code IP & Open-Source Auditing (Viral license copyleft GPL/AGPL audits, clean-room strategies, copyright audits)',
    'privacy-cyber': 'Data Sovereignty & Cybersecurity Defense (GDPR, CCPA, cyber breaches, user profiling compliance)'
  };

  const targetedSector = sectorDescriptions[sector] || "General Tech Law Compliance";

  if (!ai) {
    // If API key is missing, return fallback response detailing the setup instructions but still serving high-fidelity simulation
    console.warn("GEMINI_API_KEY is not defined. Using high-fidelity local tech-law analysis fallback.");
    
    // Custom simulated feedbacks localized for EN, ZH, and NE
    const mockFeedbacks: Record<string, Record<string, any>> = {
      en: {
        'ai-governance': {
          riskLevel: 'MEDIUM',
          score: 68,
          analysisSummary: "[SIMULATION ENGINE] Initial triage of your AI product indicates potential copyright scraping concerns and EU AI Act classification exposure. (Note: Set GEMINI_API_KEY in Secrets for live Gemini-powered analysis).",
          gaps: [
            {
              title: "Lack of Training Dataset Transparency Logs",
              description: "No specific dataset catalog model training disclosures exist in your policy, exposing the product to EU AI Act Article 53 auditing.",
              severity: 'HIGH',
              suggestedClause: "REPLACEMENT SECTION: 'Developer shall maintain detailed logs of compiled training data, filtration protocols, and copyright-consented scraping paths, accessible for regulatory auditing.'"
            },
            {
              title: "Lack of AI-User Disclosure",
              description: "If users interact directly with agents, failure to notify them programmatically violates transparency guidelines.",
              severity: 'MEDIUM',
              suggestedClause: "MITIGATION CLAUSE: 'User interfaces powered by synthetic outputs shall feature persistent, conspicuous visual labels stating: \"AI Agent Conversation Active.\"'"
            }
          ],
          statutoryConsiderations: ["EU AI Act 2024 Art. 53", "FTC Algorithmic disgorgement precedent", "U.S. Copyright Act Section 107 (Fair Use)"],
          mitigationSteps: [
            "Integrate real-time output watermarking on generated text/code.",
            "Perform a dual copyright-safety clearance scan before uploading model weights."
          ]
        },
        'smart-contracts': {
          riskLevel: 'HIGH',
          score: 35,
          analysisSummary: "[SIMULATION ENGINE] DAO governance token structures seem vulnerable to classifications as unregistered securities and joint partner liability. (Note: Set GEMINI_API_KEY in Secrets for live Gemini-powered analysis).",
          gaps: [
            {
              title: "Absence of Protocol Legal Wrapper Entity",
              description: "Operating an unincorporated DAO token structure exposes all voters and multi-sig signers to joint-and-several personal liabilities.",
              severity: 'HIGH',
              suggestedClause: "DRAFT WRAPPER STRUCT: 'The protocol is governed under the auspices of a Marshall Islands DAO LLC, limiting all voter liability strictly to staked DAO assets.'"
            },
            {
              title: "SEC Section 5 Security Risk",
              description: "If rewards distributions yield returns from a pooled treasury based on active marketing efforts, the Howey test is likely satisfied.",
              severity: 'HIGH',
              suggestedClause: "DRAFT CLAUSE: 'Tokens constitute governance tools only; no profit expectations, dynamic dividends, or liquidity pooling rewards shall be promised or disbursed.'"
            }
          ],
          statutoryConsiderations: ["Howey Test (SEC v. W.J. Howey Co.)", "CFTC Commodity Exchange Act Section 4", "Wyoming Decentralized Unincorporated Association (UNA) Act"],
          mitigationSteps: [
            "Establish an offshore Cayman Foundation wrapper for asset execution immediately.",
            "Restrict active protocol treasury distributions to non-restricted geographic regions."
          ]
        },
        'ip-strategy': {
          riskLevel: 'HIGH',
          score: 42,
          analysisSummary: "[SIMULATION ENGINE] Software integration reveals potential copyleft contagion risk, where GPLv3 or AGPL components might contaminate your SaaS infrastructure. (Note: Set GEMINI_API_KEY in Secrets for live Gemini-powered analysis).",
          gaps: [
            {
              title: "GPL Contamination on Microservice Links",
              description: "Physical linkage or compilation of copyleft components within the identical docker image can trigger source code disclosure requirements.",
              severity: 'HIGH',
              suggestedClause: "MITIGATION METHODOLOGY: 'All GPL/AGPL packages shall be sandboxed in isolated container spaces, accessed strictly over network boundary REST/gRPC interfaces without synchronous memory linking.'"
            },
            {
              title: "Un-monitored Supply Chain Open-Source Ingestion",
              description: "Your architecture allows developer package ingestion without continuous dependency licensing compliance audits.",
              severity: 'MEDIUM',
              suggestedClause: "SAAS AUDIT POLICY: 'Company shall enforce automated CI/CD gating using software composition analysis tools, blocking dependencies labeled AGPL or GPL.'"
            }
          ],
          statutoryConsiderations: ["GPL v3 Copyleft terms Section 6", "Joint-Venture Patent Pooling standards", "U.S. Patent Act 35 U.S.C."],
          mitigationSteps: [
            "Refactor GPL packages out of core proprietary microservices.",
            "Adopt high-latitude MIT/Apache legal wrappers for dual-licensing strategies."
          ]
        },
        'privacy-cyber': {
          riskLevel: 'MEDIUM',
          score: 75,
          analysisSummary: "[SIMULATION ENGINE] Initial cloud configuration indicates CCPA/GDPR compliance risk due to cross-border data routing and lack of affirmative consent structures. (Note: Set GEMINI_API_KEY in Secrets for live Gemini-powered analysis).",
          gaps: [
            {
              title: "Undefined Cross-Border Data Routing Agreements",
              description: "Routing user telemetry databases from the EU zone without Standard Contractual Clauses (SCCs) triggers multi-million GDPR file violations.",
              severity: 'HIGH',
              suggestedClause: "DRAFT SECURITY CLAUSE: 'Company pledges that all operations involving EU-resident assets shall reside exclusively on localized sovereign nodes utilizing regional servers.'"
            }
          ],
          statutoryConsiderations: ["GDPR Chapter V Article 46 Standard Contractual Clauses", "California Consumer Privacy Act CPRA additions", "SEC Cybersecurity rule 106"],
          mitigationSteps: [
            "Deploy Cookie double opt-in controls with localized geographic detection filters.",
            "Draft a structured Data Processing Agreement (DPA) incorporating approved technical security measures."
          ]
        }
      },
      zh: {
        'ai-governance': {
          riskLevel: 'MEDIUM',
          score: 68,
          analysisSummary: "【模拟合规诊断报告】初步评估表明，该AI系统涉及敏感数据采集风险与《欧盟人工智能法案》高风险等级划分风险。（提示：在系统密钥Secrets中配置GEMINI_API_KEY可启动实时法律专家分析）。",
          gaps: [
            {
              title: "缺乏人工智能模型训练数据集透明度日志",
              description: "该系统没有建立全面的训练数据过滤及版权授权追溯账本，不符合《欧盟AI法案》第53条的技术性对齐披露规范。",
              severity: 'HIGH',
              suggestedClause: "修订补充条款：'开发者应维持完备的模型训练数据集源头记录档案及合规筛分处理，确保满足监管机构审计合规标准。'"
            },
            {
              title: "人机交互界面缺少显著提示披露",
              description: "如系统具备AI自主代理（Agent）与用户直接触达，未能在交互边界主动披露，构成信息欺诈及违反透明度强制准则。",
              severity: 'MEDIUM',
              suggestedClause: "合规修订方案：'凡引入AI自主生成结果的用户交互视窗，须在首屏显著及常驻展示标示：“正在通过AI自主合规探针代理执行会话。”'"
            }
          ],
          statutoryConsiderations: ["欧盟人工智能法案 (EU AI Act) 第53条", "中国《互联网信息服务算法推荐管理规定》", "美国联邦贸易委员会 (FTC) 算法吐出相关司法判例"],
          mitigationSteps: [
            "部署端对端数字水印，确保技术系统生成结果可追溯标识。",
            "在将模型参数托管于公有云或分发前，开展独立的版权清除与对齐检测。"
          ]
        },
        'smart-contracts': {
          riskLevel: 'HIGH',
          score: 35,
          analysisSummary: "【模拟合规诊断报告】代币的分红及奖励回购模型可能诱发未予注册证券违规指控并承担无限连带民事责任风险。（提示：配置GEMINI_API_KEY启动实时分析）。",
          gaps: [
            {
              title: "去中心化自治组织（DAO）缺乏海外独立法人隔离隔离包装",
              description: "在未注册且非独立法人的合伙或极客群体内发行和流通治理代币，所有治理投票者与多签管理人均承担连带个人财产赔偿责任。",
              severity: 'HIGH',
              suggestedClause: "公司架构防卫重组草案：'本协议由设立于马绍尔群岛共和国的DAO有限责任公司（DAO LLC）行使独立诉讼阻隔。'"
            },
            {
              title: "收益沉淀与分利机制违背 Howey Test 豁免",
              description: "代币持有者通过国库质押或手续费分享获得被动分红回报，符合 Howey 四要素，有极大可能被监管机关定义为未经登记的非法证券发行。",
              severity: 'HIGH',
              suggestedClause: "代币章程重写：'通证作为仅用于系统访问与特征参数设置的纯治理工具，严禁任何形式的升值担保承诺、被动派息或利润分配计划。'"
            }
          ],
          statutoryConsiderations: ["SEC v. W.J. Howey Co. (美国联邦证券交易委员会判例)", "CFTC 商品交易法案第四条", "怀俄明州非法人自治实体法案"],
          mitigationSteps: [
            "立即在开曼群岛或瑞士配置特有法人或基金会（Foundation Wrapper）作为协议执行实体空间。",
            "对涉及主动利润分配的网络节点和前台过滤机制实施严格的合格准入和地区屏蔽规划。"
          ]
        },
        'ip-strategy': {
          riskLevel: 'HIGH',
          score: 42,
          analysisSummary: "【模拟合规诊断报告】技术系统底层库架构显露开源协议污染（例如AGPL）导致的强感染强制开源法律暴利局势限制。（提示：配置GEMINI_API_KEY启动实时深度清除）。",
          gaps: [
            {
              title: "微服务容器物理链路引起AGPL开源强传染",
              description: "在同一个构建环境、物理进程空间内调用AGPL或商业严惩类开源库，在向外部提供Web SaaS网络服务时直接触发协议传染，需强制在互联网上公开系统全部私有核心源代码。",
              severity: 'HIGH',
              suggestedClause: "微服务边界网络防护规程：'凡引入AGPL强关联模块，应通过专门API容器边界阻断，不得采用本地动态/静态库链接或同步内存共享等传染方式交互。'"
            },
            {
              title: "开发供应链中缺乏软件依赖合规前置审查",
              description: "代码仓库允许开发团队在无自动化扫描审计闸口的情况下，任意引入外部开源开源依赖。",
              severity: 'MEDIUM',
              suggestedClause: "CI/CD 审计防御标准：'公司须部署自动化的软件物料清单（SBOM）前置扫描，对任何包含 AGPL、GPL 的库直接执行拦截并终止部署作业。'"
            }
          ],
          statutoryConsiderations: ["强开源协议通用公共许可证 (GPLv3 / AGPL) 第6条规定", "双重授权与专利共同池交叉保护标准", "美国专利法案第35号法典"],
          mitigationSteps: [
            "对涉及強传染的核心依赖执行快速解耦升级并重构为MIT或Apache开源等高自由度依赖。",
            "在持续集成和部署流水线中加入静态扫描防御脚本。"
          ]
        },
        'privacy-cyber': {
          riskLevel: 'MEDIUM',
          score: 75,
          analysisSummary: "【模拟合规诊断报告】数据湖泊配置表明，跨境主权传输及隐私保护权限设定与欧洲GDPR、加州CPRA的罚款限制界限冲突。（提示：配置GEMINI_API_KEY启动实时分析）。",
          gaps: [
            {
              title: "缺乏欧盟标准合同条款与数据流动申报",
              description: "未执行严格的标准合同条款（SCCs）和出境安全评估，直接将欧盟和英国敏感 telemetry 数据流转至外部物理站点，面临极高合规调查罚款风险。",
              severity: 'HIGH',
              suggestedClause: "数据出境隔离架构：'公司承诺所有涉及欧盟居民在内的敏感身份及生物识别信息，应始终保存在物理隔离的本地主权数据中心节点内。'"
            }
          ],
          statutoryConsiderations: ["欧盟《通用数据保护条例》(GDPR) 第46条标准合同条款守则", "加利福尼亚消费者隐私法案（CPRA修订案）", "SEC 网络安全披露强制法案106条款"],
          mitigationSteps: [
            "实现严格的Cookie双向双重选择（Double Opt-In）并辅以地理位置感知隔离拦截拦截。",
            "与各跨国供应商重新制定并审定正式的书面DPA（数据处理协议），明确隐私保障边界。"
          ]
        }
      },
      ne: {
        'ai-governance': {
          riskLevel: 'MEDIUM',
          score: 68,
          analysisSummary: "【स्यान्डबक्स अनुपालन रिपोर्ट】 प्रारम्भिक अडिट अनुसार यस एआई प्रविधिमा प्रतिलिपि अधिकार तथा EU AI ऐन वर्गीकरण जोखिम देखिएको छ। (थप जानकारीका लागि Secrets मा GEMINI_API_KEY सेट गर्नुहोस्)।",
          gaps: [
            {
              title: "तालिम डाटासेट पारदर्शिता लगहरूको अभाव",
              description: "मोडेल तालिम डाटासेटमा स्पष्ट पारदर्शी अडिट प्रणाली नहुँदा EU AI ऐन धारा ५३ को उल्लङ्घन हुने जोखिम छ।",
              severity: 'HIGH',
              suggestedClause: "संशोधन बुँदा: 'विकासकर्ताले नियामक अडिटको लागि पहुँचयोग्य हुने गरी संकलित तालिम डाटा, फिल्टरेशन र प्रतिलिपि अधिकार स्वीकृतिको विस्तृत अभिलेख राख्नुपर्नेछ।'"
            }
          ],
          statutoryConsiderations: ["EU AI ऐन २०२४ धारा ५३", "U.S. प्रतिलिपि अधिकार ऐन परिच्छेद १०७"],
          mitigationSteps: [
            "उत्पादित सामग्री वा कोडमा पारदर्शी वाटरमार्किङ प्रणाली लागू गर्नुहोस्।",
            "नयाँ मोडेल लोड गर्नु अघि प्रतिलिपि अधिकार क्लियरेन्स स्क्यान गर्नुहोस्।"
          ]
        },
        'smart-contracts': {
          riskLevel: 'HIGH',
          score: 35,
          analysisSummary: "【स्यान्डबक्स अनुपालन रिपोर्ट】 DAO टोकन र विनिमय संरचना गैर-दर्ता धितोपत्र (unregistered securities) दायित्व अन्तर्गत वर्गीकृत हुन सक्ने देखिन्छ। (थप जानकारीका लागि SEC Secrets मा कुञ्जी थप्नुहोस्)।",
          gaps: [
            {
              title: "प्रोटोकल कानुनी र्यापर इकाईको अभाव",
              description: "बिना कुनै कानुनी ढाँचा वा संस्था DAO टोकन संचालन गर्दा संस्थापक र मतदाताहरू व्यक्तिगत दायित्वको खतरामा पर्दछन्।",
              severity: 'HIGH',
              suggestedClause: "र्यापर मस्यौदा: 'यो प्रोटोकल मार्शल टापुको DAO LLC को दायरा भित्र संचालित हुनेछ जसले मतदाताको दायित्वलाई सीमित गर्दछ।'"
            }
          ],
          statutoryConsiderations: ["हावे परीक्षण (SEC v. Howey)", "कमोडिटी एक्सचेन्ज ऐन धारा ४"],
          mitigationSteps: [
            "लगानीकर्ताको सुरक्षाका लागि केम्यान वा स्विस फाउन्डेसन र्यापर तत्काल लागू गर्नुहोस्।",
            "परामर्श सेवाहरूका लागि स्थानीय कानुनको मस्यौदा तयार गर्नुहोस्।"
          ]
        }
      }
    };

    const currentMockLang = mockFeedbacks[language] || mockFeedbacks.en;
    const fallbackResponse = currentMockLang[sector] || currentMockLang['ai-governance'] || mockFeedbacks.en['ai-governance'];
    fallbackResponse.apiKeyMissing = true;
    return res.json(fallbackResponse);
  }

  try {
    const prompt = `
      You are a highly analytical, specialized Technology Lawyer and Systems Auditor.
      Analyze the following tech-venture product concept or contract draft details against the regulatory guidelines of: ${targetedSector}.

      CRITICAL MANDATE: You MUST provide your entire analysis, summaries, titles, descriptions, recommendations, statutory considerations, and suggested clauses in the following language: ${language === 'zh' ? 'Chinese (中文)' : language === 'ne' ? 'Nepali (नेपाली)' : 'English'}.

      === TARGET PROJECT / TEXT COMPONENT ===
      ${productDescription}

      === OPTIONAL EXTRA CONTEXT OR CLAUSES ===
      ${contextText || 'None provided.'}

      === AUDITING PARAMETERS ===
      1. Calculate an integer legal compliance score from 0 (extreme liability / critical non-compliance) to 100 (exemplary technical legal structure).
      2. Categorize the overarching risk level as: "LOW", "MEDIUM", or "HIGH".
      3. Identify specific "gaps" (minimum 1, maximum 3) outlining real technical compliance issues.
      4. For EACH gap, write a realistic, legally sound drafted clause ("suggestedClause") that can mitigate the issue or be injected into terms/contracts.
      5. Include any specific statutory chapters or regulations under "statutoryConsiderations" (e.g., "EU AI Act Art. 12", "GDPR Art 32").
      6. Outline strategic "mitigationSteps" for the engineering team.

      Format your output STRICTLY as a single JSON object fitting our responseSchema. Keep text highly professional, direct, analytical, and tailored to developer-attorneys.
    `;

    console.log(`Analyzing project sector: ${sector} with Gemini in language: ${language}...`);

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          required: ["riskLevel", "score", "analysisSummary", "gaps", "statutoryConsiderations", "mitigationSteps"],
          properties: {
            riskLevel: { 
              type: Type.STRING, 
              description: "Must be exactly LOW, MEDIUM, or HIGH" 
            },
            score: { 
              type: Type.INTEGER, 
              description: "Compliance safety score integer from 0 to 100" 
            },
            analysisSummary: { 
              type: Type.STRING, 
              description: "Comprehensive critique of compliance, identifying core exposures, structural issues, and liability risks." 
            },
            gaps: {
              type: Type.ARRAY,
              description: "Array of specific compliance gaps discovered.",
              items: {
                type: Type.OBJECT,
                required: ["title", "description", "severity", "suggestedClause"],
                properties: {
                  title: { type: Type.STRING, description: "Actionable name of the compliance gap found" },
                  description: { type: Type.STRING, description: "Detailed explanation of why this is a risk under the given regulatory regime" },
                  severity: { type: Type.STRING, description: "Can be LOW, MEDIUM, or HIGH" },
                  suggestedClause: { type: Type.STRING, description: "A concrete legally drafted boilerplate clause, term, or engineering strategy statement that resolves this specific exposure" }
                }
              }
            },
            statutoryConsiderations: {
              type: Type.ARRAY,
              description: "List of relevant legislative rules, articles, laws, or precedents",
              items: { type: Type.STRING }
            },
            mitigationSteps: {
              type: Type.ARRAY,
              description: "Specific step-by-step guidance for the technical team to follow to achieve a compliant deploy",
              items: { type: Type.STRING }
            }
          }
        },
        temperature: 0.2
      }
    });

    const reportText = response.text;
    if (!reportText) {
      throw new Error("No output text received from Gemini server-side call.");
    }

    const parsedReport = JSON.parse(reportText.trim());
    parsedReport.apiKeyMissing = false;
    res.json(parsedReport);

  } catch (error: any) {
    console.error("Gemini Compliance Analysis Failure:", error);
    res.status(500).json({ error: "Failed to execute compliance analysis. " + (error?.message || error) });
  }
});

// TechLaw News & Legal Insights Grounded API Endpoint
app.post("/api/legal-insights", async (req, res) => {
  const { language = 'en' } = req.body;
  const ai = getGeminiClient();

  // 5 high-fidelity localized fallback articles
  const fallbackInsights = {
    en: [
      {
        title: "EU AI Act Implementation Timeline and First Audit Precedents",
        source: "European Commission Regulatory Watch",
        date: "June 2026",
        summary: "As high-risk AI system obligations kick in, national supervisory authorities launch their first investigations into compliance programs of large algorithmic profiling tools, setting precedent for model lineage auditing.",
        url: "https://digital-strategy.ec.europa.eu/en/policies/regulatory-framework-ai",
        category: "AI Regulation"
      },
      {
        title: "Marshall Islands and Wyoming DAO LLC Structure Protections Affirmed in Court",
        source: "Delaware & Wyoming Court Updates",
        date: "May 2026",
        summary: "A milestone ruling confirms that developers operating as a registered Marshall Islands DAO LLC are protected from personal joint-and-several partnership liabilities, validating the role of on-chain operations wrappers.",
        url: "https://wyoleg.gov",
        category: "DAO/Web3"
      },
      {
        title: "Federal Trade Commission (FTC) Issues New Guidelines on Generative AI Telemetry & Scraping",
        source: "Federal Trade Commission",
        date: "June 2026",
        summary: "The FTC warning specifies that companies scraping user-generated source code and web data without clear opt-out systems may face mandatory 'algorithmic disgorgement' orders, forcing them to delete violating models.",
        url: "https://www.ftc.gov",
        category: "Privacy"
      },
      {
        title: "Open Source Software Liability: First Decisions on Copilot Copyright Infringement Claims",
        source: "EFF Tech Law Updates",
        date: "May 2026",
        summary: "Federal courts clarify the 'Fair Use' doctrine boundaries when models trained on GPL-licensed software generate identical output blocks without reproducing copyright attributions.",
        url: "https://www.eff.org",
        category: "Open Source"
      },
      {
        title: "California Data Sovereignty & CCPA Enforcement for AI Agent Networks",
        source: "California Privacy Protection Agency (CPPA)",
        date: "June 2026",
        summary: "The CPPA targets autonomous decentralized agent networks, enforcing that temporary memory logs must fully support data deletion requests under standard consumer privacy rights.",
        url: "https://cppa.ca.gov",
        category: "Digital Sovereignty"
      }
    ],
    zh: [
      {
        title: "《欧盟人工智能法案》分阶段落地时间表与首批审计判例",
        source: "欧盟委员会监管观察组",
        date: "2026年6月",
        summary: "随着针对高风险AI系统合规义务的全面收紧，各成员国主权监管部门对大规模算法画像和分析工具展开了首轮合规稽查，确立了神经网络训练集血统溯源与日志归档的技术范式。",
        url: "https://digital-strategy.ec.europa.eu/en/policies/regulatory-framework-ai",
        category: "AI Regulation"
      },
      {
        title: "马绍尔群岛及怀俄明州 DAO LLC 实体屏蔽效力获得美国法庭最新判例确认",
        source: "美国特拉华与怀俄明州最新判例速递",
        date: "2026年5月",
        summary: "里程碑式判决确认，运营于 Marshall Islands DAO LLC 合法实体框架下的去中心化协议参与代币投票者，完全免于被归入“无限连带普通合伙”重税与债务兜底指控，充分证明了链上硬包装架构的排他性价值。",
        url: "https://wyoleg.gov",
        category: "DAO/Web3"
      },
      {
        title: "美国联邦贸易委员会 (FTC) 针对生成式 AI 服务器遥测及网页爬虫下达强制纠偏指引",
        source: "FTC 官方政讯",
        date: "2026年6月",
        summary: "FTC 重申：任何擅自抓取开源社区代码库与个人用户隐私隐私日志，却未能提供简单程序化拒准（Opt-Out）机制的公司，将面临极为严厉的“算法吐出（Algorithmic Disgorgement）”处罚，须彻底销毁污染的模型权重。",
        url: "https://www.ftc.gov",
        category: "Privacy"
      },
      {
        title: "开源协议病毒扩散诉讼案：法院就商业代码模型代码侵权索赔发布初审意见",
        source: "电子前哨基金会 (EFF) 技术与法律专论",
        date: "2026年5月",
        summary: "美国联邦上诉法院进一步明确：当自动生成代码工具在生成阶段完美复现了 GPL 强开源范畴的核心算法结构，且未伴随展示任何许可证附加签名时，是否满足版权法第107条合理使用（Fair Use）的判定标准与赔偿豁免区。",
        url: "https://www.eff.org",
        category: "Open Source"
      },
      {
        title: "加州隐私保护大局 (CPPA) 启动针对去中心化自主 AI Agent 临时缓存流的管理抽查",
        source: "CPPA 官方发布",
        date: "2026年6月",
        summary: "加利福尼亚州隐私保护局启动了对完全免许可智能体交互接口的隐私红线抽检，严厉督促所有基于多模态自主规划的 Agent 网络，必须百分百响应并执行在途临时交互会话数据清除要求。",
        url: "https://cppa.ca.gov",
        category: "Digital Sovereignty"
      }
    ],
    ne: [
      {
        title: "EU AI ऐन कार्यान्वयनको पछिल्लो चरण र पहिलो अडिटका दृष्टान्तहरू",
        source: "EU नियामक निकाय",
        date: "जुन २०२६",
        summary: "उच्च जोखिमयुक्त एआई प्रणालीमाथि नियमन कडाइ गरिएसँगै ठूला एआई ढाँचाहरूको तालिम र डाटा सङ्कलन प्रकियामाथि पहिलो पटक आधिकारिक अनुसन्धान थालिएको छ। यसले डाटा पारदर्शिताको नयाँ मापदण्ड सेट गर्छ।",
        url: "https://digital-strategy.ec.europa.eu/en/policies/regulatory-framework-ai",
        category: "AI Regulation"
      },
      {
        title: "मार्शल टापु र वायोमिङको DAO LLC संरचनालाई अदालतद्वारा मान्यता",
        source: "वायोमिङ कानूनी अपडेट",
        date: "मे २०२६",
        summary: "एक महत्त्वपूर्ण अदालती फैसलाले मार्शल टापुको DAO LLC र वायोमिङको विकेन्द्रीकृत कानूनी ढाँचा अन्तर्गत सञ्चालित विकासकर्ताहरूलाई व्यक्तिगत दायित्वबाट पूर्ण सुरक्षा प्रदान गरेको छ। यसले सुरक्षित अन-चेन कानूनी रक्षकको भूमिका प्रमाणित गर्छ।",
        url: "https://wyoleg.gov",
        category: "DAO/Web3"
      },
      {
        title: "एफटीसी (FTC) द्वारा एआई मोडुल तालिम र डाटा सुरक्षित सङ्कलनमा नयाँ मापदण्ड जारी",
        source: "संयक्त राज्य अमेरिका उपभोक्ता संरक्षण",
        date: "जुन २०२६",
        summary: "खुला स्रोतबाट प्रयोगकर्ताको सहमति बिना कोड र डाटा सङ्कलन गरी तालिम दिइएका एआई मोडेलहरूमाथि जरिवाना तिराउनुका साथै अवैध रूपमा सङ्कलन गरिएका डाटाहरू नष्ट गर्न आदेश दिने चेतावनी एफटीसीले दिएको छ।",
        url: "https://www.ftc.gov",
        category: "Privacy"
      },
      {
        title: "खुला स्रोत सफ्टवेयर दायित्व: कपि-पेस्ट कोड सम्बन्धी प्रतिलिपि अधिकार मुद्दामा पहिलो फैसला",
        source: "ईएफएफ (EFF) प्राविधिक कानून",
        date: "मे २०२६",
        summary: "खुला स्रोत समुदायको जिएपिएल (GPL) लाइसेन्स प्राप्त कोडहरू व्यावसायिक रूपमा एआई तालिममा प्रयोग गर्दा र त्यसको सिर्जनाकर्ताको नाम उल्लेख नगर्दा उत्पन्न हुने दायित्व र कानुनी सर्तहरूको दायरा अदालतले स्पष्ट पारेको छ।",
        url: "https://www.eff.org",
        category: "Open Source"
      },
      {
        title: "क्यालिफोर्निया गोपनीयता संरक्षण प्राधिकरण (CPPA) द्वारा एआई एजेन्टहरूमाथि अनुगमन",
        source: "क्यालिफोर्निया कानून सम्पादन",
        date: "जुन २०२६",
        summary: "क्यालिफोर्नियाको उपभोक्ता गोपनीयता ऐन (CCPA) अन्तर्गत मानवरहित स्वायत्त एआई एजेन्ट नेटवर्कहरूले प्रयोगकर्ताबाट लिएका डाटाहरू प्रयोगकर्ताको माग अनुसार तुरुन्तै मेटाउनु पर्ने नयाँ नियम कडा रूपमा लागु गरेको छ।",
        url: "https://cppa.ca.gov",
        category: "Digital Sovereignty"
      }
    ]
  };

  const selectedFallback = fallbackInsights[language as keyof typeof fallbackInsights] || fallbackInsights.en;

  if (!ai) {
    console.log("No GEMINI_API_KEY found, serving high-fidelity placeholder insights.");
    return res.json({ insights: selectedFallback, source: "mock-cache", apiKeyMissing: true });
  }

  try {
    const prompt = `Retrieve 5 actual and extremely significant technology law news stories, legislation updates, lawsuits, or regulatory decisions related to:
1. Artificial Intelligence safety or compliance (e.g. EU AI Act, FTC algorithmic disgorgement, or US state laws).
2. Open Source software licensing liabilities or litigation.
3. Privacy, Data Sovereignty, or cross-border cloud restrictions.
4. Smart contracts, DAO legal structures, crypto-assets, or web3 liability rulings.

Ensure all retrieved news are recent or highly influential.
Your response MUST be formatted strictly as a JSON object containing a property 'insights' which is an array of 5 objects.
Each object within 'insights' must have these exact keys:
- 'title': (string) authoritative and interesting headline
- 'source': (string) reliable news journal, public agency, or legal blog
- 'date': (string) estimated month/year (e.g., "June 2026" or "May 2026")
- 'summary': (string) clear 2-3 sentence summary detailing the legal implications, risks, and technical background.
- 'url': (string) a valid web link pointing to the article source from the google search grounding
- 'category': (string) one of "AI Regulation", "Open Source", "Privacy", "DAO/Web3", or "Digital Sovereignty"

Please also output the response in the user requested language: "${language === 'zh' ? 'Chinese (中文)' : language === 'ne' ? 'Nepali (नेपाली)' : 'English (en)'}" where appropriate (translate title, source, summary, etc. to make it perfectly localized. Keep category names as standard Latin categories: "AI Regulation", "Open Source", "Privacy", "DAO/Web3", "Digital Sovereignty").

Ensure you return ONLY a raw JSON string of this object. Do not include markdown \`\`\`json code blocks, do not include conversational lead-ins or wrap with anything else. Just the pure valid JSON.`;

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        tools: [{ googleSearch: {} }],
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          required: ["insights"],
          properties: {
            insights: {
              type: Type.ARRAY,
              description: "List of 5 legal news insights",
              items: {
                type: Type.OBJECT,
                required: ["title", "source", "date", "summary", "url", "category"],
                properties: {
                  title: { type: Type.STRING },
                  source: { type: Type.STRING },
                  date: { type: Type.STRING },
                  summary: { type: Type.STRING },
                  url: { type: Type.STRING },
                  category: { type: Type.STRING }
                }
              }
            }
          }
        }
      }
    });

    const text = response.text;
    if (!text) {
      throw new Error("Empty response text from Gemini Search Grounding.");
    }

    const data = JSON.parse(text);
    const groundingMetadata = response.candidates?.[0]?.groundingMetadata;
    const sources = groundingMetadata?.groundingChunks || [];

    res.json({
      insights: data.insights || selectedFallback,
      source: "gemini-grounded",
      sourcesRef: sources,
      apiKeyMissing: false
    });

  } catch (error: any) {
    console.error("Gemini Search Grounded Legal Insights failed. Recovering with fallback: ", error);
    res.json({
      insights: selectedFallback,
      source: "fallback-recovery",
      errorDetails: error?.message || error,
      apiKeyMissing: false
    });
  }
});

// ==========================================
// CLIENT PORTAL & XML DATABASE ENGINE
// ==========================================

interface ClientNote {
  id: string;
  date: string;
  author: string;
  content: string;
}

interface ClientRecord {
  username: string;
  passwordHash: string;
  fullName: string;
  caseNumber: string;
  status: string;
  priority: string;
  assignedCounsel: string;
  nextAction: string;
  jurisdiction: string;
  notes: ClientNote[];
}

const XML_PATH = path.join(process.cwd(), 'clients_db.xml');

// Help escape XML characters to avoid breaks in syntax
function escapeXml(str: string): string {
  return (str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function unescapeXml(str: string): string {
  return (str || '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

function getTagValue(xmlBlock: string, tag: string): string {
  const regex = new RegExp(`<${tag}>([\\s\\S]*?)<\/${tag}>`);
  const match = xmlBlock.match(regex);
  return match ? unescapeXml(match[1].trim()) : "";
}

// Function to write all clients to XML
function writeXmlDb(clients: ClientRecord[]) {
  let xmlStr = `<?xml version="1.0" encoding="UTF-8"?>\n<clients>\n`;
  for (const c of clients) {
    xmlStr += `  <client>\n`;
    xmlStr += `    <username>${escapeXml(c.username)}</username>\n`;
    xmlStr += `    <passwordHash>${escapeXml(c.passwordHash)}</passwordHash>\n`;
    xmlStr += `    <fullName>${escapeXml(c.fullName)}</fullName>\n`;
    xmlStr += `    <caseNumber>${escapeXml(c.caseNumber)}</caseNumber>\n`;
    xmlStr += `    <status>${escapeXml(c.status)}</status>\n`;
    xmlStr += `    <priority>${escapeXml(c.priority)}</priority>\n`;
    xmlStr += `    <assignedCounsel>${escapeXml(c.assignedCounsel)}</assignedCounsel>\n`;
    xmlStr += `    <nextAction>${escapeXml(c.nextAction)}</nextAction>\n`;
    xmlStr += `    <jurisdiction>${escapeXml(c.jurisdiction)}</jurisdiction>\n`;
    xmlStr += `    <notes>\n`;
    if (c.notes) {
      for (const n of c.notes) {
        xmlStr += `      <note>\n`;
        xmlStr += `        <id>${escapeXml(n.id)}</id>\n`;
        xmlStr += `        <date>${escapeXml(n.date)}</date>\n`;
        xmlStr += `        <author>${escapeXml(n.author)}</author>\n`;
        xmlStr += `        <content>${escapeXml(n.content)}</content>\n`;
        xmlStr += `      </note>\n`;
      }
    }
    xmlStr += `    </notes>\n`;
    xmlStr += `  </client>\n`;
  }
  xmlStr += `</clients>\n`;
  fs.writeFileSync(XML_PATH, xmlStr, "utf8");
}

// Function to read all clients from XML
function readXmlDb(): ClientRecord[] {
  if (!fs.existsSync(XML_PATH)) {
    const seed: ClientRecord[] = [
      {
        username: "alice",
        passwordHash: "alice123", // simplified plain string matching for client portal demo
        fullName: "Alice Devco (Sovereign Trust DAO)",
        caseNumber: "LT-2026-0042",
        status: "Marshall Islands DAO LLC Wrapping Completed",
        priority: "Urgent",
        assignedCounsel: "Dr. Elena Vance, Esq.",
        nextAction: "File Wyoming DAO Articles of Amendment to shield multi-sig validation relays.",
        jurisdiction: "Marshall Islands",
        notes: [
          { id: "n1", date: "June 15, 2026", author: "Dr. Elena Vance, Esq.", content: "Initial multi-sig ledger signature verified. Liability wrapper successfully bound." },
          { id: "n2", date: "June 20, 2026", author: "Alice Devco", content: "Added backup recovery key coordinates to protocol archive." }
        ]
      },
      {
        username: "bob",
        passwordHash: "bob123",
        fullName: "Bob Mercer (ZKP Privacy Network)",
        caseNumber: "LT-2026-0591",
        status: "Under Active Swiss Foundation Charter Evaluation",
        priority: "High",
        assignedCounsel: "Harlan Cole, Senior Compliance Director",
        nextAction: "Reviewing training pipeline data-scraping consent logs for EU AI Act conformity.",
        jurisdiction: "Switzerland",
        notes: [
          { id: "n3", date: "May 29, 2026", author: "Harlan Cole", content: "Completed secondary check of the zero-knowledge validation contracts." }
        ]
      }
    ];
    writeXmlDb(seed);
    return seed;
  }

  try {
    const rawContent = fs.readFileSync(XML_PATH, "utf8");
    const clients: ClientRecord[] = [];
    const clientBlocks = rawContent.match(/<client>([\s\S]*?)<\/client>/g) || [];
    
    for (const block of clientBlocks) {
      const username = getTagValue(block, "username");
      const passwordHash = getTagValue(block, "passwordHash");
      const fullName = getTagValue(block, "fullName");
      const caseNumber = getTagValue(block, "caseNumber");
      const status = getTagValue(block, "status");
      const priority = getTagValue(block, "priority");
      const assignedCounsel = getTagValue(block, "assignedCounsel");
      const nextAction = getTagValue(block, "nextAction");
      const jurisdiction = getTagValue(block, "jurisdiction");
      
      const notes: ClientNote[] = [];
      const noteBlocks = block.match(/<note>([\s\S]*?)<\/note>/g) || [];
      for (const nb of noteBlocks) {
        notes.push({
          id: getTagValue(nb, "id"),
          date: getTagValue(nb, "date"),
          author: getTagValue(nb, "author"),
          content: getTagValue(nb, "content")
        });
      }

      clients.push({
        username,
        passwordHash,
        fullName,
        caseNumber,
        status,
        priority,
        assignedCounsel,
        nextAction,
        jurisdiction,
        notes
      });
    }
    return clients;
  } catch (error) {
    console.error("Failed to parse clients_db.xml, returning empty: ", error);
    return [];
  }
}

// 1. POST: Register new client username
app.post("/api/client/register", (req, res) => {
  const { username, password, fullName, jurisdiction = "Delaware" } = req.body;
  
  if (!username || !password || !fullName) {
    return res.status(400).json({ error: "Missing required fields (username, password, or fullName)" });
  }

  const normalizedUser = username.trim().toLowerCase();
  
  const db = readXmlDb();
  const exists = db.some(c => c.username.toLowerCase() === normalizedUser);
  
  if (exists) {
    return res.status(409).json({ error: `Username "${username}" already exists in XML database.` });
  }

  const caseIdSuffix = Math.floor(1000 + Math.random() * 9000);
  const newClient: ClientRecord = {
    username: normalizedUser,
    passwordHash: password, // Demonstration plain password in XML matching criteria
    fullName: fullName.trim(),
    caseNumber: `LT-2026-${caseIdSuffix}`,
    status: "Initial Intake Processing - Awaiting Consultation",
    priority: "Medium",
    assignedCounsel: "None - Allocation Pending Evaluation",
    nextAction: "Complimentary 30-minute legal diagnostic review & compliance sandbox initialization.",
    jurisdiction,
    notes: [
      {
        id: "n_init",
        date: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
        author: "Vidhijnya Legal System",
        content: "Account created. Case dossier and secure XML container initialized successfully."
      }
    ]
  };

  db.push(newClient);
  writeXmlDb(db);
  
  // Return info without password
  const { passwordHash, ...safeClient } = newClient;
  res.json({ message: "Registration successful in XML base", client: safeClient });
});

// 2. POST: Client login
app.post("/api/client/login", (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: "Missing username or password" });
  }

  const normalizedUser = username.trim().toLowerCase();
  const db = readXmlDb();
  
  const client = db.find(c => c.username.toLowerCase() === normalizedUser);
  
  if (!client || client.passwordHash !== password) {
    return res.status(401).json({ error: "Invalid username or password" });
  }

  const { passwordHash, ...safeClient } = client;
  res.json({ success: true, client: safeClient });
});

// 3. POST: Add case journal log to client record
app.post("/api/client/add-note", (req, res) => {
  const { username, author, content } = req.body;

  if (!username || !author || !content) {
    return res.status(400).json({ error: "Missing username, author, or content" });
  }

  const normalizedUser = username.trim().toLowerCase();
  const db = readXmlDb();
  const clientIndex = db.findIndex(c => c.username.toLowerCase() === normalizedUser);

  if (clientIndex === -1) {
    return res.status(404).json({ error: "Client username not found" });
  }

  const newNote: ClientNote = {
    id: "n_" + Date.now(),
    date: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
    author: author.trim(),
    content: content.trim()
  };

  if (!db[clientIndex].notes) {
    db[clientIndex].notes = [];
  }
  db[clientIndex].notes.push(newNote);
  writeXmlDb(db);

  res.json({ success: true, notes: db[clientIndex].notes });
});

// App initialization logic (Vite Dev Server or Production Static Serving)
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    // Development Environment: Dev server binds Vite directly as Express middleware
    console.log("Starting server in DEVELOPMENT mode. Initializing Vite middleware...");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    // Production Environment: Serves compiled static react files from /dist
    console.log("Starting server in PRODUCTION mode. Serving static assets...");
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`LexTech Chambers custom server listening on port ${PORT}`);
  });
}

startServer();
