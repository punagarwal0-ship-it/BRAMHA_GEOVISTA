`timescale 1ns/1ps
module sar_output_interface_tb;
    reg clk = 1'b0;
    always #5 clk = ~clk;

    reg rst, change_in, last_in, valid_in, ready_out;
    reg [7:0] enhanced_in;
    wire ready_in, change_out, valid_out, done;
    wire [7:0] enhanced_out;
    integer errors;

    sar_output_interface dut (
        .clk(clk), .rst(rst), .enhanced_in(enhanced_in),
        .change_in(change_in), .last_in(last_in), .valid_in(valid_in),
        .ready_in(ready_in), .enhanced_out(enhanced_out),
        .change_out(change_out), .valid_out(valid_out),
        .ready_out(ready_out), .done(done)
    );

    initial begin
        errors=0; rst=1; valid_in=0; ready_out=0;
        enhanced_in=0; change_in=0; last_in=0;
        repeat (2) @(posedge clk);
        @(negedge clk); rst=0;

        // Capture the first output while the receiver is stalled.
        valid_in=1; enhanced_in=8'h55; change_in=1; last_in=0;
        @(posedge clk); #1;
        if (valid_out!==1 || enhanced_out!==8'h55 || change_out!==1 || ready_in!==0 || done!==0) begin
            $display("FAIL first item capture/stall"); errors=errors+1;
        end

        // Try to present the final item while stalled; current output must hold.
        @(negedge clk); enhanced_in=8'hA5; change_in=0; last_in=1;
        @(posedge clk); #1;
        if (valid_out!==1 || enhanced_out!==8'h55 || change_out!==1 || ready_in!==0 || done!==0) begin
            $display("FAIL output changed during stall"); errors=errors+1;
        end

        // Transfer first item and accept the final item on the same edge.
        @(negedge clk); ready_out=1;
        @(posedge clk); #1;
        if (valid_out!==1 || enhanced_out!==8'hA5 || change_out!==0 || done!==0) begin
            $display("FAIL simultaneous transfer/replacement"); errors=errors+1;
        end

        // Drain the final item; done must pulse with its transfer.
        @(negedge clk); valid_in=0;
        @(posedge clk); #1;
        if (valid_out!==0 || done!==1) begin
            $display("FAIL final transfer/done"); errors=errors+1;
        end
        @(posedge clk); #1;
        if (done!==0) begin $display("FAIL done was not a pulse"); errors=errors+1; end

        if (errors==0) $display("PASS: sar_output_interface_tb");
        else $display("FAIL: %0d error(s)",errors);
        $finish;
    end
endmodule
