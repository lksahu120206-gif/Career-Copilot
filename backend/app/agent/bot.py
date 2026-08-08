import os
from typing import List, Optional
from dotenv import load_dotenv
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.prompts import ChatPromptTemplate, MessagesPlaceholder
from langchain_core.messages import HumanMessage, AIMessage
from langchain_core.output_parsers import StrOutputParser
from langchain_chroma import Chroma
from langchain_huggingface import HuggingFaceEmbeddings
from langchain_community.tools import DuckDuckGoSearchRun
from app.models.schemas import StudentProfile

load_dotenv()

# 1. Setup Local Database Connection
BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
DB_DIR = os.path.join(BASE_DIR, "chroma_db")

print("🔌 Connecting to Vector Database...")
embeddings = HuggingFaceEmbeddings(model_name="all-MiniLM-L6-v2")
vector_store = Chroma(persist_directory=DB_DIR, embedding_function=embeddings)
retriever = vector_store.as_retriever(search_kwargs={"k": 3})

# 2. Setup Global Web Search Tool
web_search = DuckDuckGoSearchRun()

# 3. Setup Google Gemini LLM
llm = ChatGoogleGenerativeAI(
    model="gemini-1.5-flash",
    google_api_key=os.getenv("GEMINI_API_KEY"),
    temperature=0.7
)

def generate_mentor_response(user_message: str, profile: StudentProfile, chat_history: Optional[List] = None) -> str:
    # Retrieve relevant documents from Chroma vector store
    docs = retriever.invoke(user_message)
    context_text = "\n\n".join([doc.page_content for doc in docs])

    # Perform web search for up-to-date data if needed
    search_results = ""
    try:
        search_results = web_search.run(user_message)
    except Exception:
        search_results = "Web search unavailable."

    # Construct the system prompt using the user's profile and context
    system_prompt = f"""
    You are an expert Engineering Career Copilot mentor. 
    You are helping a student with the following profile:
    - Year: {profile.year}
    - Branch: {profile.branch}
    - Current Skills: {', '.join(profile.current_skills)}
    - Interests: {', '.join(profile.interests)}
    - Target Goal: {profile.target_goal}
    - Timeline: {profile.timeline}

    Strictly guide them towards their engineering career goals. Use the following retrieved document context and web search results to answer their question accurately.

    Context from Documents:
    {context_text}

    Web Search Results:
    {search_results}
    """

    prompt = ChatPromptTemplate.from_messages([
        ("system", system_prompt),
        MessagesPlaceholder(variable_name="history"),
        ("human", "{input}")
    ])

    # Format history
    formatted_history = []
    if chat_history:
        for msg in chat_history:
            if getattr(msg, 'role', None) == 'user':
                formatted_history.append(HumanMessage(content=msg.text))
            else:
                formatted_history.append(AIMessage(content=msg.text))

    chain = prompt | llm | StrOutputParser()
    
    response = chain.invoke({
        "history": formatted_history,
        "input": user_message
    })

    return response