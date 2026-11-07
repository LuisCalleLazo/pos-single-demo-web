from flask import Flask, render_template

app = Flask(__name__)

@app.route('/')
def index():
  cursos = ['PHP', 'Python', 'Java', 'Kotlin', 'Dart', 'JavaScript']
  data = {
    'titulo' : 'Index123',
    'bienvenida': '!Saludos¡',
    'cursos' : cursos,
    'numero_cursos' : len(cursos)
  }
  return render_template('index.html', data= data)

if __name__ == '__main__':
  app.run(debug=False, port=5000)
