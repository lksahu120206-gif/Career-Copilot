from google import genai
import os

# Initialize the client using your environment variable
client = genai.Client(api_key=os.getenv("GEMINI_API_KEY"))

# Iterate through and print all active model endpoints
for model in client.models.list():
    print(model.name)
