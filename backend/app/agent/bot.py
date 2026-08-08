import os
from langchain_ollama import ChatOllama
from langchain_core.prompts import ChatPromptTemplate, MessagesPlaceholder
from langchain_core.messages import HumanMessage, AIMessage, BaseMessage
from langchain_core.output_parsers import StrOutputParser
from langchain_chroma import Chroma
from langchain_huggingface import HuggingFaceEmbeddings
from langchain_community.tools import DuckDuckGoSearchRun
from app.models.schemas import StudentProfile, ChatMessage

# 1. Setup Local Database Connection
BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
DB_DIR = os.path.join(BASE_DIR, "chroma_db")

print("🔌 Connecting to Vector Database...")
embeddings = HuggingFaceEmbeddings(model_name="all-MiniLM-L6-v2")
vector_store = Chroma(persist_directory=DB_DIR, embedding_function=embeddings)
retriever = vector_store.as_retriever(search_kwargs={"k": 3}) 

# 2. Setup Global Web Search Tool
web_search = DuckDuckGoSearchRun()

# 3. Setup the LLM
llm = ChatOllama(model="llama3", temperature=0.7)

# 4. Update System Prompt
system_message = """You are the Engineering Career Copilot, an expert mentor and research assistant.
The student profile is: Year {year}, {branch} branch.
Skills: {current_skills}. Goal: {target_goal} within {timeline}. Interests: {interests}

Your rules:
1. Break concepts down, explain the 'why', and ask a guiding question.
2. Provide well-structured, factual summaries with bullet points.
3. Tailor advice to the student's profile.
4. The Strict Boundary: Refuse non-engineering/non-career questions politely.

=== KNOWLEDGE BASE CONTEXT ===
Use the following retrieved information to answer the student's question accurately. 
You have access to both highly curated local documents and live web search results.

{context}
==============================
"""

prompt = ChatPromptTemplate.from_messages([
    ("system", system_message),
    MessagesPlaceholder(variable_name="chat_history"), # Memory goes here
    ("human", "{message}")
])

chain = prompt | llm | StrOutputParser()

# Notice list[ChatMessage] here to satisfy Pylance
def generate_mentor_response(user_message: str, history: list[ChatMessage], profile: StudentProfile) -> str:
    
    # Format the incoming history for LangChain
    formatted_history: list[BaseMessage] = []
    for msg in history:
        if msg.role == 'user':
            formatted_history.append(HumanMessage(content=msg.text))
        elif msg.role == 'ai':
            formatted_history.append(AIMessage(content=msg.text))

    print(f"\n1. 🔍 Searching Local DB for: '{user_message}'...")
    retrieved_docs = retriever.invoke(user_message)
    local_context = "\n\n".join([doc.page_content for doc in retrieved_docs])
    print(f"   ✅ Found {len(retrieved_docs)} local chunks.")

    print("2. 🌍 Searching the Live Web via DuckDuckGo...")
    try:
        web_context = web_search.invoke(user_message)
        print("   ✅ Web search successful.")
    except Exception as e:
        web_context = "Web search unavailable at the moment."
        print(f"   ❌ Web search failed: {e}")

    combined_context = f"--- LOCAL DATABASE RESULTS ---\n{local_context}\n\n--- LIVE WEB RESULTS ---\n{web_context}"

    print("3. 🤖 Sending Hybrid Context + Memory to Ollama Llama 3...")
    
    response = chain.invoke({
        "message": user_message,
        "chat_history": formatted_history, 
        "context": combined_context,
        "year": profile.year,
        "branch": profile.branch,
        "target_goal": profile.target_goal,
        "timeline": profile.timeline,
        "current_skills": ", ".join(profile.current_skills),
        "interests": ", ".join(profile.interests)
    })
    
    print("4. 🎉 Response received!")
    return response     