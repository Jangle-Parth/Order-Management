import tkinter as tk
from tkinter import messagebox
from tkinter import ttk

# Create the main application window
root = tk.Tk()
root.title("Manpower Tracking - Ashtavinayaka Technocrafts Pvt Ltd")
root.geometry("800x600")

# Branding (Company Name & Logo)
brand_frame = tk.Frame(root, bg="lightblue")
brand_frame.pack(fill="x", pady=10)

brand_label = tk.Label(brand_frame, text="Ashtavinayaka Technocrafts Pvt Ltd", font=("Arial", 24), bg="lightblue")
brand_label.pack(pady=10)

# Sample tank data with tasks, time, and manpower
tank_data = {
    "Tank A": [
        {"task": "Shell Cutting", "time": 5, "manpower": 4},
        {"task": "Shell Bending", "time": 3, "manpower": 3},
        {"task": "Shell Welding", "time": 7, "manpower": 6}
    ],
    "Tank B": [
        {"task": "Shell Cutting", "time": 6, "manpower": 5},
        {"task": "Shell Bending", "time": 4, "manpower": 4},
        {"task": "Shell Welding", "time": 8, "manpower": 7}
    ],
    "Tank C": [
        {"task": "Shell Cutting", "time": 4, "manpower": 3},
        {"task": "Shell Bending", "time": 2, "manpower": 2},
        {"task": "Shell Welding", "time": 6, "manpower": 5}
    ]
}

# Activity Tracking Section
activity_frame = tk.Frame(root)
activity_frame.pack(pady=20)

# Task Variables
tank_var = tk.StringVar()
task_var = tk.StringVar()
time_var = tk.StringVar()
manpower_var = tk.StringVar()

tasks = ["Shell Cutting", "Shell Bending", "Shell Welding", "Polishing", "Quality Check"]

# Function to populate tasks based on selected tank
def load_tank_tasks(event):
    selected_tank = tank_var.get()
    
    # Clear previous tasks in the list
    for item in task_list.get_children():
        task_list.delete(item)
    
    # Load tasks for the selected tank
    if selected_tank in tank_data:
        for task in tank_data[selected_tank]:
            task_list.insert("", tk.END, values=(task["task"], task["time"], task["manpower"]))

# Tank Selection Widgets
tk.Label(activity_frame, text="Select Tank").grid(row=0, column=0, padx=10, pady=10)
tank_menu = ttk.Combobox(activity_frame, textvariable=tank_var, values=list(tank_data.keys()))
tank_menu.grid(row=0, column=1, padx=10, pady=10)
tank_menu.bind("<<ComboboxSelected>>", load_tank_tasks)

# Task List (Table)
task_list_frame = tk.Frame(root)
task_list_frame.pack(pady=20)

tk.Label(task_list_frame, text="Assigned Tasks", font=("Arial", 14)).pack(pady=10)

task_list = ttk.Treeview(task_list_frame, columns=("Task", "Time Required", "Workers"), show="headings")
task_list.heading("Task", text="Task")
task_list.heading("Time Required", text="Time Required (hrs)")
task_list.heading("Workers", text="No. of Workers")

task_list.pack()

# Function to generate report
def generate_report():
    tasks = task_list.get_children()
    if not tasks:
        messagebox.showerror("Error", "No tasks to generate a report.")
        return

    report = "Task Report for {}:\n".format(tank_var.get())
    for task in tasks:
        values = task_list.item(task, 'values')
        report += f"Task: {values[0]}, Time Required: {values[1]} hrs, Workers: {values[2]}\n"
    
    messagebox.showinfo("Task Report", report)

# Additional Feature: Estimate Time Based on Manpower
def estimate_time():
    total_time = 0
    tasks = task_list.get_children()
    for task in tasks:
        values = task_list.item(task, 'values')
        total_time += int(values[1])  # Sum up time for all tasks

    if tasks:
        messagebox.showinfo("Estimated Time", f"Estimated total time for task completion: {total_time} hours.")
    else:
        messagebox.showerror("Error", "Please select a tank and tasks first.")

# Bottom Buttons for additional features
button_frame = tk.Frame(root)
button_frame.pack(pady=20)

tk.Button(button_frame, text="Generate Report", command=generate_report).grid(row=0, column=0, padx=10)
tk.Button(button_frame, text="Estimate Time", command=estimate_time).grid(row=0, column=1, padx=10)

# Run the application
root.mainloop()
