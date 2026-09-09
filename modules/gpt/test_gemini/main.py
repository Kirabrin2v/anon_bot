from google import genai

client = genai.Client()

interaction = client.interactions.create(
    model="gemini-3.5-flash-lite",
    input="Расскажи анекдот"
)
print(interaction.output_text)
