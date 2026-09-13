// import { GoogleGenAI } from "@google/genai";

// const ai = new GoogleGenAI({
//   apiKey: process.env.AI_API_KEY,
// });

// export = async function testAI() {
//   try {
//     const response = await ai.models.generateContent({
//       model: "gemini-3.6-flash",
//       contents: "Say hello and tell me that the AI integration is working.",
//     });

//     console.log("AI Response:");
//     console.log(response.text);
//   } catch (error) {
//     console.error("AI Error:", error);
//   }
// }


// Fuction testing AI integration with Google GenAI
import {
  FunctionCallingConfigMode,
  GoogleGenAI,
  Type,
  type Content,
} from "@google/genai";

const ai = new GoogleGenAI({
  apiKey: process.env.AI_API_KEY,
});

const queryDatabase = async (args: {
  collection: string;
  operation: string;
}) => {
  console.log("🔧 Tool called:", args);

  // Dummy database result
  return {
    collection: args.collection,
    operation: args.operation,
    totalRevenue: 125430,
  };
};

export = async function testAI() {
  try {
    const contents: Content[] = [
      {
        role: "user",
        parts: [
          {
            text: "What is the total revenue this month? Use the query_database tool to get the answer.",
          },
        ],
      },
    ];

    // First Gemini request
    const response = await ai.models.generateContent({
      model: "gemini-3.6-flash",
      contents,

      config: {
        tools: [
          {
            functionDeclarations: [
              {
                name: "query_database",
                description:
                  "Query the application database to retrieve business information such as orders, revenue, products, sales, inventory, and users.",

                parameters: {
                  type: Type.OBJECT,
                  properties: {
                    collection: {
                      type: Type.STRING,
                      description:
                        "The database collection that should be queried.",
                    },

                    operation: {
                      type: Type.STRING,
                      description:
                        "The read-only database operation to perform, such as find or aggregate.",
                    },
                  },

                  required: ["collection", "operation"],
                },
              },
            ],
          },
        ],

        toolConfig: {
          functionCallingConfig: {
            mode: FunctionCallingConfigMode.AUTO,
          },
        },
      },
    });

    console.log("Gemini response:");

    // Check whether Gemini requested a function
    if (!response.functionCalls?.length) {
      console.log(response.text);
      return;
    }

    // Add Gemini's function-call response to conversation
    contents.push({
      role: "model",
      parts: response.candidates?.[0]?.content?.parts ?? [],
    });

    // Execute every requested function
    for (const call of response.functionCalls) {
      console.log("📞 Function call:", call);

      if (call.name === "query_database") {
        const result = await queryDatabase(
          call.args as {
            collection: string;
            operation: string;
          },
        );

        console.log("📊 Tool result:", result);

        // Send function result back to Gemini
        contents.push({
          role: "user",
          parts: [
            {
              functionResponse: {
                name: call.name,
                id: call.id,
                response: result,
              },
            },
          ],
        });
      }
    }

    // Second Gemini request
    const finalResponse = await ai.models.generateContent({
      model: "gemini-3.6-flash",
      contents,

      config: {
        tools: [
          {
            functionDeclarations: [
              {
                name: "query_database",
                description:
                  "Query the application database to retrieve business information such as orders, revenue, products, sales, inventory, and users.",

                parameters: {
                  type: Type.OBJECT,
                  properties: {
                    collection: {
                      type: Type.STRING,
                    },

                    operation: {
                      type: Type.STRING,
                    },
                  },

                  required: ["collection", "operation"],
                },
              },
            ],
          },
        ],
      },
    });

    console.log("🤖 Final AI Response:");
    console.log(finalResponse.text);
  } catch (error) {
    console.error("AI Error:", error);
  }
};