FROM python:3.11-slim

WORKDIR /app

# Install dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application
COPY . .

# Create directories
RUN mkdir -p /downloads /app/data

# Expose port
EXPOSE 6199

# Run application
CMD ["python", "app.py"]
