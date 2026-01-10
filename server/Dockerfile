FROM python:3.11-alpine

WORKDIR /app

# Install build dependencies for Python packages with C extensions
RUN apk add --no-cache gcc musl-dev libffi-dev

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
